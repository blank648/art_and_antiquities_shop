// ============== IMPORTURI MODULE ==============
const express = require('express');
const path = require('path');
const fs = require('fs');
const sass = require('sass');

// ============== INITIALIZARE SERVER ==============
const app = express();
const PORT = 8080;

// Setarea EJS ca motor de vizualizare
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============== CONFIGURARE GLOBALĂ ȘI INIȚIALIZARE ==============
const obGlobal = {
    erori: null,
    eroare_default: null,
    folderScss: path.join(__dirname, "public/css"),
    folderCss: path.join(__dirname, "public/css"),
    folderBackup: path.join(__dirname, "public/resurse/css/backup")
};

const vect_foldere = ['temp', 'temp1', 'logs', obGlobal.folderBackup];
vect_foldere.forEach(folder => {
    const caleFolder = path.isAbsolute(folder) ? folder : path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder, { recursive: true });
        console.log(`Folderul "${path.basename(caleFolder)}" a fost creat.`);
    }
});

console.log("===================================================");
console.log("Caile serverului la pornire:", `\n   -> Folder proiect: ${__dirname}`, `\n   -> Cale fișier: ${__filename}`, `\n   -> Folder de lucru: ${process.cwd()}`);
console.log("===================================================");

// ============== FUNCȚII HELPER ==============
function initErori() {
    const caleErori = path.join(__dirname, 'public/resurse/json/erori.json');
    if (fs.existsSync(caleErori)) {
        const eroriData = JSON.parse(fs.readFileSync(caleErori, 'utf8'));
        obGlobal.erori = eroriData.info_erori.map(err => {
            err.imagine = path.join(eroriData.cale_baza, err.imagine);
            return err;
        });
        obGlobal.eroare_default = eroriData.eroare_default;
        obGlobal.eroare_default.imagine = path.join(eroriData.cale_baza, obGlobal.eroare_default.imagine);
    } else {
        console.error("Fișierul erori.json nu a fost găsit! Sistemul de erori nu va funcționa corect.");
    }
}
initErori();

function afisareEroare(res, identificator) {
    if (!obGlobal.erori) return res.status(500).send("Sistemul de erori nu este initializat.");
    const eroare = obGlobal.erori.find(e => e.identificator == identificator) || obGlobal.eroare_default;
    res.status(eroare.status || 500).render('partials/eroare', {
        titlu: eroare.titlu,
        text: eroare.text,
        imagine: eroare.imagine
    });
}

function compileazaScss(caleFisierScss) {
    if (!fs.existsSync(caleFisierScss)) {
        console.warn(`Atentie: Fisierul sursa SCSS nu a fost gasit: ${caleFisierScss}`);
        return;
    }
    const numeFisierScss = path.basename(caleFisierScss);
    console.log(`-> Incepe compilarea pentru: ${numeFisierScss}`);
    try {
        // ================================================================= //
        // ========= VERIFICĂ ACEST BLOC DE COD CU MARE ATENȚIE ========= //
        // ================================================================= //
        const rezultat = sass.compile(caleFisierScss, {
            sourceMap: true,
            // ACEASTĂ LINIE ESTE CRUCIALĂ ȘI REZOLVĂ EROAREA:
            loadPaths: [path.join(__dirname, 'node_modules')]
        });
        // ================================================================= //

        const numeFisierCss = numeFisierScss.replace(".scss", ".css");
        const caleFisierCss = path.join(obGlobal.folderCss, numeFisierCss);

        if (fs.existsSync(caleFisierCss)) {
            const timestamp = new Date().getTime();
            const numeBackup = `${path.basename(numeFisierCss, '.css')}_${timestamp}.css`;
            const caleBackup = path.join(obGlobal.folderBackup, numeBackup);
            fs.copyFileSync(caleFisierCss, caleBackup);
        }

        fs.writeFileSync(caleFisierCss, rezultat.css);
        console.log(`   -> Fisierul ${numeFisierCss} a fost compilat si salvat cu succes.`);

    } catch (err) {
        console.error(`\n====== EROARE la compilarea ${numeFisierScss} ======\n`, err.message);
    }
}

// ============== RUTELE APLICAȚIEI ==============
// ACEASTA ESTE ORDINEA CORECTĂ: RUTELE SPECIFICE VIN ÎNAINTEA `express.static`

app.get(['/', '/index', '/home'], (req, res) => {
    res.render('index', {
        ip: req.ip,
        title: 'The Vintage Mosaic',
        images: []
    });
});

app.get('/:pagina', (req, res, next) => {
    const calePagina = path.join(__dirname, 'views', `${req.params.pagina}.ejs`);
    if (fs.existsSync(calePagina)) {
        res.render(req.params.pagina, {
            ip: req.ip,
            title: req.params.pagina.charAt(0).toUpperCase() + req.params.pagina.slice(1)
        });
    } else {
        next();
    }
});

// ============== SERVIREA FIȘIERELOR STATICE ==============
// Acest middleware trebuie să vină DUPĂ rutele definite
app.use(express.static(path.join(__dirname, 'public')));


// ============== HANDLER-UL FINAL PENTRU 404 ==============
// Se va executa doar dacă nicio rută sau fișier static nu a fost găsit
app.use((req, res) => {
    afisareEroare(res, 404);
});


// ============== COMPILARE SCSS ȘI PORNIRE SERVER ==============
console.log("===================================================");
console.log("Incepe compilarea initiala a fisierelor SCSS...");
fs.readdirSync(obGlobal.folderScss).forEach(fisier => {
    if (fisier !== 'galerie.scss' && path.extname(fisier).toLowerCase() === ".scss") {
        compileazaScss(path.join(obGlobal.folderScss, fisier));
    }
});
console.log("Compilarea initiala a fost finalizata.");
console.log("===================================================");

fs.watch(obGlobal.folderScss, (eveniment, numeFisier) => {
    if (numeFisier && numeFisier !== 'galerie.scss' && path.extname(numeFisier).toLowerCase() === ".scss") {
        console.log(`\n[WATCHER] Detectata o modificare (${eveniment}) in fisierul: ${numeFisier}`);
        setTimeout(() => compileazaScss(path.join(obGlobal.folderScss, numeFisier)), 200);
    }
});

app.listen(PORT, () => {
    console.log(`Serverul ruleaza la http://localhost:${PORT}`);
});