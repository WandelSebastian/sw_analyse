package main

import (
	"os"

	"github.com/MeKo-Tech/go-react/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
