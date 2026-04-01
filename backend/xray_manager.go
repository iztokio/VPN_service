package main

import (
	"context"
	"strings"
	"time"

	"github.com/xtls/xray-core/app/proxyman/command"
	statsCmd "github.com/xtls/xray-core/app/stats/command"
	"github.com/xtls/xray-core/common/protocol"
	"github.com/xtls/xray-core/common/serial"
	"github.com/xtls/xray-core/proxy/vless"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type XrayManager struct {
	client      command.HandlerServiceClient
	statsClient statsCmd.StatsServiceClient
	conn        *grpc.ClientConn
}

func NewXrayManager(target string) (*XrayManager, error) {
	conn, err := grpc.Dial(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &XrayManager{
		client:      command.NewHandlerServiceClient(conn),
		statsClient: statsCmd.NewStatsServiceClient(conn),
		conn:        conn,
	}, nil
}

func (m *XrayManager) Close() error { return m.conn.Close() }

func (m *XrayManager) AddUser(uuid string, email string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Add to standard TCP Reality (with vision flow)
	userTCP := &protocol.User{
		Level: 0,
		Email: email,
		Account: serial.ToTypedMessage(&vless.Account{
			Id:   uuid,
			Flow: "xtls-rprx-vision",
		}),
	}
	_, err := m.client.AlterInbound(ctx, &command.AlterInboundRequest{
		Tag:       "vless-in",
		Operation: serial.ToTypedMessage(&command.AddUserOperation{User: userTCP}),
	})
	if err != nil {
		return err
	}

	// 2. Add to gRPC Reality (no flow) for better RU DPI bypass
	userGRPC := &protocol.User{
		Level: 0,
		Email: email,
		Account: serial.ToTypedMessage(&vless.Account{
			Id:   uuid,
			Flow: "",
		}),
	}
	_, err = m.client.AlterInbound(ctx, &command.AlterInboundRequest{
		Tag:       "vless-grpc-ru",
		Operation: serial.ToTypedMessage(&command.AddUserOperation{User: userGRPC}),
	})
	return err
}

func (m *XrayManager) RemoveUser(email string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Remove from standard TCP Reality
	_, err := m.client.AlterInbound(ctx, &command.AlterInboundRequest{
		Tag:       "vless-in",
		Operation: serial.ToTypedMessage(&command.RemoveUserOperation{Email: email}),
	})
	if err != nil {
		// Even if first fails, try to remove from second
	}

	// Remove from gRPC Reality
	_, err = m.client.AlterInbound(ctx, &command.AlterInboundRequest{
		Tag:       "vless-grpc-ru",
		Operation: serial.ToTypedMessage(&command.RemoveUserOperation{Email: email}),
	})
	return err
}

// UserTraffic holds uplink/downlink stats for a single user
type UserTraffic struct {
	Email    string `json:"email"`
	Uplink   int64  `json:"uplink_bytes"`
	Downlink int64  `json:"downlink_bytes"`
}

// SystemStats holds global traffic for the node
type SystemStats struct {
	TotalUplink   int64 `json:"total_uplink_bytes"`
	TotalDownlink int64 `json:"total_downlink_bytes"`
}

// GetTrafficStats queries Xray stats service for all user and system traffic
func (m *XrayManager) GetTrafficStats() ([]UserTraffic, SystemStats, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := m.statsClient.QueryStats(ctx, &statsCmd.QueryStatsRequest{
		Pattern: "",
		Reset_:  false,
	})
	if err != nil {
		return nil, SystemStats{}, err
	}

	userMap := make(map[string]*UserTraffic)
	var sysStats SystemStats

	for _, stat := range resp.Stat {
		name := stat.Name
		val := stat.Value

		// User traffic: "user>>>email>>>traffic>>>uplink" or "downlink"
		if strings.HasPrefix(name, "user>>>") {
			parts := strings.Split(name, ">>>")
			if len(parts) < 4 {
				continue
			}
			email := parts[1]
			direction := parts[3]

			if _, ok := userMap[email]; !ok {
				userMap[email] = &UserTraffic{Email: email}
			}
			if direction == "uplink" {
				userMap[email].Uplink += val
			} else if direction == "downlink" {
				userMap[email].Downlink += val
			}
		}

		// Inbound/System traffic: "inbound>>>vless-in>>>traffic>>>uplink" etc.
		if strings.HasPrefix(name, "inbound>>>") {
			parts := strings.Split(name, ">>>")
			if len(parts) < 4 {
				continue
			}
			direction := parts[3]
			if direction == "uplink" {
				sysStats.TotalUplink += val
			} else if direction == "downlink" {
				sysStats.TotalDownlink += val
			}
		}
	}

	users := make([]UserTraffic, 0, len(userMap))
	for _, u := range userMap {
		users = append(users, *u)
	}

	return users, sysStats, nil
}
