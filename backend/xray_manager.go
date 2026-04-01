package main

import (
	"context"
	"time"

	"github.com/xtls/xray-core/app/proxyman/command"
	"github.com/xtls/xray-core/common/protocol"
	"github.com/xtls/xray-core/common/serial"
	"github.com/xtls/xray-core/proxy/vless"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type XrayManager struct {
	client command.HandlerServiceClient
	conn   *grpc.ClientConn
}

func NewXrayManager(target string) (*XrayManager, error) {
	conn, err := grpc.Dial(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &XrayManager{client: command.NewHandlerServiceClient(conn), conn: conn}, nil
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
