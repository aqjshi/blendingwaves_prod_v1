package main

import (
	"encoding/json"
	"html/template"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
)

// Item represents one entry from data/items.json
type Item struct {
	ID           int      `json:"id"`
	KeywordTitle string   `json:"keyword_title"`
	Texts        []string `json:"texts"`
	VideoPath    []string `json:"video_path"`
	VideoCredit  []string `json:"video_credit"`
	ItemLink     string   `json:"ItemLink"`
}

var items []Item
var tmpl *template.Template // Declare tmpl at package level

func loadItems() {
	currDir, err := os.Getwd()
	if err != nil {
		log.Fatalf("Failed to get working directory: %v", err)
	}
	filePath := filepath.Join(currDir, "static", "data", "items.json")

	f, err := os.Open(filePath)
	if err != nil {
		log.Fatalf("Failed to open %s: %v", filePath, err)
	}
	defer f.Close()

	if err := json.NewDecoder(f).Decode(&items); err != nil {
		log.Fatalf("Failed to decode items.json: %v", err)
	}
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	data := map[string]interface{}{
		"Title": "BlendingWaves",
		"Items": items,
	}
	if err := tmpl.ExecuteTemplate(w, "home.html", data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func main() {
	// 1) Load and resolve items
	loadItems()

	// Parse templates: header, footer, and home
	var err error
	tmpl, err = template.ParseFiles(
		"templates/header.html",
		"templates/footer.html",
		"templates/home.html",
	)
	if err != nil {
		log.Fatalf("Error parsing templates: %v", err)
	}

	// 2) Dynamic handler for the home page:
	http.HandleFunc("/", homeHandler)

	// 3) Serve everything under ./static/ at URL path /static/
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	// Serve the CSS file at /styles.css
	http.HandleFunc("/styles.css", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "styles.css")
	})

	// Serve the JavaScript file at /main.js
	http.HandleFunc("/main.js", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "main.js")
	})

	http.HandleFunc("/privacy", func(w http.ResponseWriter, r *http.Request) {
		if err := tmpl.ExecuteTemplate(w, "header.html", nil); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// You would have a separate privacy.html template or content here
		w.Write([]byte("<h1>Privacy Policy</h1><p>Your privacy is important to us.</p>"))
		if err := tmpl.ExecuteTemplate(w, "footer.html", nil); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	http.HandleFunc("/tou", func(w http.ResponseWriter, r *http.Request) {
		if err := tmpl.ExecuteTemplate(w, "header.html", nil); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// You would have a separate tou.html template or content here
		w.Write([]byte("<h1>Terms of Use</h1><p>Please read our terms of use.</p>"))
		if err := tmpl.ExecuteTemplate(w, "footer.html", nil); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	http.HandleFunc("/non", func(w http.ResponseWriter, r *http.Request) {
		if err := tmpl.ExecuteTemplate(w, "header.html", nil); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// You would have a separate non.html template or content here
		w.Write([]byte("<h1>Nondiscrimination Policy</h1><p>We are committed to nondiscrimination.</p>"))
		if err := tmpl.ExecuteTemplate(w, "footer.html", nil); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	ln, err := net.Listen("tcp4", ":8080")
	if err != nil {
		log.Fatalf("Failed to bind to IPv4: %v", err)
	}
	log.Println("Listening on http://0.0.0.0:8080 …")
	log.Fatal(http.Serve(ln, nil))
}
