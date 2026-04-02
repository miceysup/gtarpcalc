package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// App struct
type App struct {
	ctx      context.Context
	dataPath string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Определяем путь для хранения данных
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}
	a.dataPath = filepath.Join(homeDir, ".gtarp-finance")
	os.MkdirAll(a.dataPath, 0755)
}

// SaveData сохраняет данные в файл
func (a *App) SaveData(key string, data string) error {
	filePath := filepath.Join(a.dataPath, key+".json")
	return os.WriteFile(filePath, []byte(data), 0644)
}

// LoadData загружает данные из файла
func (a *App) LoadData(key string) (string, error) {
	filePath := filepath.Join(a.dataPath, key+".json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return "{}", nil
		}
		return "", err
	}
	return string(data), nil
}

// GetAppVersion возвращает версию приложения
func (a *App) GetAppVersion() string {
	return "3.0.0"
}

// GetDataPath возвращает путь к файлам данных
func (a *App) GetDataPath() string {
	return a.dataPath
}

// ExportData возвращает все данные для экспорта
func (a *App) ExportData() (string, error) {
	keys := []string{"gtarp-v3-app", "gtarp-v3-shift", "gtarp-v3-vito"}
	result := make(map[string]json.RawMessage)

	for _, key := range keys {
		data, err := a.LoadData(key)
		if err != nil {
			continue
		}
		result[key] = json.RawMessage(data)
	}

	out, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return "", fmt.Errorf("export error: %w", err)
	}
	return string(out), nil
}
