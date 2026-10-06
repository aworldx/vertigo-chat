// Command geo-import prepares community data without touching the running chat.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"chat/api/internal/geocatalog/adapters/community"
	"chat/api/internal/geocatalog/adapters/filecatalog"
	"chat/api/internal/geocatalog/application"
	"chat/api/internal/geocatalog/domain"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	manifest := flag.String("manifest", "", "path to pinned source manifest (required)")
	catalog := flag.String("catalog", "", "catalogue JSON path (required; parent must exist)")
	apply := flag.Bool("apply", false, "persist import; default only reports proposed changes")
	flag.Parse()
	if *manifest == "" || *catalog == "" || flag.NArg() != 0 {
		return fmt.Errorf("usage: geo-import -manifest path -catalog path [-apply]")
	}
	source, records, err := community.Read(*manifest)
	if err != nil {
		return err
	}
	report, err := application.Import(filecatalog.Store{Path: *catalog}, source, records, *apply)
	if err != nil {
		return err
	}
	return json.NewEncoder(os.Stdout).Encode(struct {
		Source  string        `json:"source"`
		Applied bool          `json:"applied"`
		Report  domain.Report `json:"report"`
	}{source.ID, *apply, report})
}
