const express = require('express');
const path = require('path');
const fs = require('fs');
const sass = require('sass');

const app = express();
const PORT = 8080;

// Configurarea folderelor globale
global.folderScss = path.join(__dirname, 'public', 'css');
global.folderCss = path.join(__dirname, 'public', 'css');
global.folderBackup = path.join(global.folderCss, 'backup');

// Variabile globale pentru date
const obGlobal = { erori: null, eroare_default: null };
const galerieData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'resurse', 'json', 'galerie.json'), 'utf8'));

// Initializare erori
function initErori() {
    const eroriRaw = fs.readFileSync(path.join(__dirname, 'public', 'resurse', 'json', 'erori.json'), 'utf-8');
    const conf = JSON.parse(eroriRaw);
    obGlobal.erori = conf.info_erori;
    obGlobal.eroare_default = conf.eroare_default;
}
initErori();

// Creare foldere necesare la pornire
const vect_foldere = ['temp', global.folderBackup];
vect_foldere.forEach(f => {
    const full = path.isAbsolute(f) ? f : path.join(__dirname, f);
    if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// Functie pentru compilare SASS cu backup
async function compileazaScss(caleScss) {
    console.log(`[SASS] Compiling: ${path.basename(caleScss)}`);
    const numeFisierCss = path.basename(caleScss, '.scss') + '.css';
    const caleCss = path.join(global.folderCss, numeFisierCss);

    if (fs.existsSync(caleCss)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `${path.basename(caleScss, '.scss')}_${timestamp}.css`;
        const backupPath = path.join(global.folderBackup, backupFileName);
        try {
            fs.copyFileSync(caleCss, backupPath);
            console.log(`[SASS] Backup created: ${backupFileName}`);
        } catch (err) {
            console.error(`[SASS ERROR] Backup failed for ${numeFisierCss}:`, err);
        }
    }

    try {
        const result = await sass.compileAsync(caleScss, { style: 'expanded', loadPaths: [path.join(__dirname, 'node_modules')] });
        fs.writeFileSync(caleCss, result.css.toString());
        console.log(`[SASS] Compiled successfully: ${numeFisierCss}`);
    } catch (err) {
        console.error(`[SASS ERROR] Failed to compile ${path.basename(caleScss)}:`, err.message);
    }
}

// Functie care porneste compilarea initiala si monitorizarea
async function setupSass() {
    console.log('[SASS] Starting initial compilation...');
    const scssFiles = fs.readdirSync(global.folderScss).filter(file => file.endsWith('.scss'));
    for (const file of scssFiles) {
        await compileazaScss(path.join(global.folderScss, file));
    }
    console.log('[SASS] Initial compilation finished.');

    console.log(`[SASS] Watching for changes in: ${global.folderScss}`);
    fs.watch(global.folderScss, (eventType, filename) => {
        if (filename && filename.endsWith('.scss')) {
            console.log(`[SASS] Change detected (${eventType}): ${filename}`);
            compileazaScss(path.join(global.folderScss, filename));
        }
    });
}

// Setari EJS si servire fisiere statice
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'html')));

// =============== Rutele Aplicatiei ===============

// Blocare acces direct la directoare
app.get('/resurse/*/', (req, res) => afisareEroare(res, 403));
// Blocare acces direct la fisiere .ejs
app.get('/*.ejs', (req, res) => afisareEroare(res, 400));
// Ruta dedicata pentru Favicon
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'resurse', 'ico', 'favicon.ico')));

// Ruta pentru pagina principala
app.get(['/', '/index', '/home'], (req, res) => {
    const anotimpuri = ["primavara", "vara", "toamna", "iarna"];
    const lunaCurenta = new Date().getMonth(); // 0-11
    const anotimpCurent = anotimpuri[Math.floor(lunaCurenta / 3)];

    const imaginiFiltrate = galerieData.imagini.filter(img => img.anotimp === anotimpCurent);

    res.render('index', {
        ip: req.ip,
        imagini: imaginiFiltrate,
        cale_baza: galerieData.cale_baza
    });
});

// Ruta dinamica pentru orice alta pagina
app.get('/*', (req, res) => {
    const paginaCeruta = req.path.slice(1);
    // Randam pagina ceruta din folderul 'views'
    res.render(paginaCeruta, { ip: req.ip }, (err, html) => {
        if (err) {
            // Daca fisierul .ejs nu exista, afisam eroarea 404
            if (err.message.includes('Failed to lookup view')) {
                return afisareEroare(res, 404);
            }
            // Pentru orice alta eroare, afisam o eroare de server
            return afisareEroare(res, 500);
        }
        res.send(html);
    });
});

// Functie unica si corecta pentru afisarea erorilor
function afisareEroare(res, identificator = 500) {
    let eroare = obGlobal.erori.find(e => e.identificator == identificator) || obGlobal.eroare_default;
    // Asiguram formatul corect al caii pentru URL
    let caleImagine = path.join("/resurse/eroare/", eroare.imagine).replace(/\\/g, '/');

    res.status(eroare.status || 500).render('partials/eroare', {
        titlu: eroare.titlu,
        text: eroare.text,
        imagine: caleImagine
    });
}

// Pornirea serverului
app.listen(PORT, () => {
    setupSass();
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
    console.log('__dirname:', __dirname);
});