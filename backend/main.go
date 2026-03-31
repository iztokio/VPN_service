package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type User struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UUID      string     `gorm:"uniqueIndex" json:"uuid"`
	TgID      int64      `json:"tg_id"`
	Status    string     `gorm:"default:'active'" json:"status"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at"`
}

var (
	db          *gorm.DB
	xrayManager *XrayManager
)

type CreateKeyResponse struct {
	VlessURL string `json:"vless_url"`
}

func main() {
	// Setup file + stdout logging
	logFile, err := os.OpenFile("/app/data/app.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatalf("Failed to open log file: %v", err)
	}
	defer logFile.Close()
	multiWriter := io.MultiWriter(os.Stdout, logFile)
	log.SetOutput(multiWriter)
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)

	log.Println("[STARTUP] VPN Backend starting...")

	// Database
	db, err = gorm.Open(sqlite.Open("/app/data/vpn.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("[STARTUP] Failed db: %v", err)
	}
	db.AutoMigrate(&User{})
	log.Println("[STARTUP] Database connected")

	// Xray gRPC manager
	xrayAddr := os.Getenv("XRAY_API_ADDR")
	if xrayAddr == "" {
		xrayAddr = "xray:10085"
	}
	xrayManager, err = NewXrayManager(xrayAddr)
	if err != nil {
		log.Fatalf("[STARTUP] Failed xray mgr: %v", err)
	}
	log.Printf("[STARTUP] Connected to Xray gRPC at %s", xrayAddr)

	// Sync existing users to Xray on startup
	syncUsersOnStartup()

	// Fiber app
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})
	app.Use(cors.New())

	// Auth middleware
	adminToken := os.Getenv("ADMIN_TOKEN")
	authMiddleware := func(c *fiber.Ctx) error {
		if adminToken == "" {
			return c.Next() // Allow if no token configured
		}
		authHeader := c.Get("Authorization")
		if authHeader != "Bearer "+adminToken {
			return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
		}
		return c.Next()
	}

	// Routes
	app.Get("/api/health", handleHealth)

	api := app.Group("/api", authMiddleware)
	api.Post("/keys", handleCreateKey)
	api.Delete("/keys/:uuid", handleDeleteKey)
	api.Get("/logs/download", handleDownloadLogs)
	api.Get("/users", handleListUsers)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Println("[STARTUP] Listening on :3000")
		if err := app.Listen(":3000"); err != nil {
			log.Printf("[ERROR] Server: %v", err)
		}
	}()

	<-quit
	log.Println("[SHUTDOWN] Graceful shutdown initiated...")
	_ = app.Shutdown()
	_ = xrayManager.Close()
	sqlDB, _ := db.DB()
	_ = sqlDB.Close()
	log.Println("[SHUTDOWN] Complete")
}

// syncUsersOnStartup re-registers all active users from DB into Xray
// This ensures VPN keys survive Xray restarts
func syncUsersOnStartup() {
	var users []User
	db.Where("status = ?", "active").Find(&users)
	synced := 0
	for _, u := range users {
		err := xrayManager.AddUser(u.UUID, "user_"+u.UUID[:6])
		if err != nil {
			log.Printf("[SYNC] Failed user %s: %v", u.UUID[:8], err)
		} else {
			synced++
		}
	}
	log.Printf("[SYNC] Synced %d/%d active users to Xray", synced, len(users))
}

func handleCreateKey(c *fiber.Ctx) error {
	newUUID := uuid.New().String()
	exp := time.Now().AddDate(0, 1, 0) // default 30 days
	user := User{
		UUID:      newUUID,
		Status:    "active",
		CreatedAt: time.Now(),
		ExpiresAt: &exp,
	}

	if err := db.Create(&user).Error; err != nil {
		log.Printf("[ERROR] DB create: %v", err)
		return c.Status(500).SendString("db error")
	}

	email := "user_" + newUUID[:6]
	if err := xrayManager.AddUser(newUUID, email); err != nil {
		log.Printf("[ERROR] gRPC AddUser: %v", err)
		return c.Status(500).SendString("xray error: " + err.Error())
	}

	vlessURL := fmt.Sprintf(
		// SNI must match one of the serverNames in xray/config.json realitySettings
		// fp=chrome is the most natural TLS fingerprint for Reality obfuscation
		"vless://%s@%s:443?type=tcp&security=reality&pbk=%s&fp=chrome&sni=addons.mozilla.org&sid=%s&spx=%%2F&flow=xtls-rprx-vision#VPN-%s",
		newUUID, os.Getenv("SERVER_IP"), os.Getenv("REALITY_PUBLIC_KEY"), os.Getenv("REALITY_SHORT_ID"), newUUID[:4],
	)

	log.Printf("[KEY] Created key %s for email %s", newUUID[:8], email)
	return c.JSON(CreateKeyResponse{VlessURL: vlessURL})
}

func handleDeleteKey(c *fiber.Ctx) error {
	targetUUID := c.Params("uuid")
	var user User
	if err := db.Where("uuid = ?", targetUUID).First(&user).Error; err != nil {
		return c.Status(404).SendString("user not found")
	}

	email := "user_" + user.UUID[:6]
	if err := xrayManager.RemoveUser(email); err != nil {
		log.Printf("[WARN] gRPC remove failed for %s: %v", email, err)
	}

	user.Status = "disabled"
	db.Save(&user)
	log.Printf("[KEY] Deleted key %s", targetUUID[:8])
	return c.JSON(fiber.Map{"status": "deleted", "uuid": targetUUID})
}

func handleDownloadLogs(c *fiber.Ctx) error {
	logPath := "/app/data/app.log"
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		return c.Status(404).SendString("No logs found")
	}
	c.Set("Content-Disposition", "attachment; filename=server-logs.txt")
	c.Set("Content-Type", "text/plain; charset=utf-8")
	return c.SendFile(logPath)
}

func handleListUsers(c *fiber.Ctx) error {
	var users []User
	db.Order("id desc").Limit(50).Find(&users)
	return c.JSON(users)
}

func handleHealth(c *fiber.Ctx) error {
	var count int64
	db.Model(&User{}).Where("status = ?", "active").Count(&count)
	return c.JSON(fiber.Map{
		"status":       "ok",
		"active_users": count,
		"server_ip":    os.Getenv("SERVER_IP"),
	})
}
