//import module
const express = require('express');
const path = require('path');
const fs = require('fs');
const sass = require('sass');

//initializare server
//2. creare server express care sa asculta pe portul 8080
const app = express();
const PORT = 8080;

//4. folosim ejs pt generare/randare
app.set('view engine', 'ejs');
//4. facem un folder views in radacina proiectului
app.set('views', path.join(__dirname, 'views'));

// configurare globala si initializare
// 13. se va crea o variabila globala obGlobal
//e5 pregatire de lucru
const obGlobal = {
    erori: null,
    eroare_default: null,
    folderScss: path.join(__dirname, "public/css"),
    folderCss: path.join(__dirname, "public/css"),
    folderBackup: path.join(__dirname, "public/resurse/css/backup")
};

//20. foldere in care proiectul genereaza fisiere
//e5 folderul de backup la creare automata
const vect_foldere = ['temp', 'temp1', 'logs', obGlobal.folderBackup];//folderele verificate la pornire
vect_foldere.forEach(folder => {
    //construim alte cai
    const caleFolder = path.isAbsolute(folder) ? folder : path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder, { recursive: true });
        console.log(`Folderul "${path.basename(caleFolder)}" a fost creat.`);
    }
});

//3. calea folderului care contine _dirname
console.log("===================================================");
console.log("Caile serverului la pornire:", `\n   -> Folder proiect: ${__dirname}`, `\n   -> Cale fisier: ${__filename}`, `\n   -> Folder de lucru: ${process.cwd()}`);
console.log("===================================================");

//functii helper
//13. functia initErori
function initErori() {
    //11 folosim erori.json
    const caleErori = path.join(__dirname, 'public/resurse/json/erori.json');
    if (fs.existsSync(caleErori)) {
        const eroriData = JSON.parse(fs.readFileSync(caleErori, 'utf8'));
        //11c info_erori
        obGlobal.erori = eroriData.info_erori.map(err => {
            //11a cale_baza
            err.imagine = path.join(eroriData.cale_baza, err.imagine);
            return err;
        });

        //11b eroare_default
        obGlobal.eroare_default = eroriData.eroare_default;
        obGlobal.eroare_default.imagine = path.join(eroriData.cale_baza, obGlobal.eroare_default.imagine);
    } else {
        console.error("Fisierul erori.json nu a fost gasit! Sistemul de erori nu va functiona corect.");
    }
}
initErori();
/*
        http://localhost:8080/orice/nume.ejs
        http://localhost:8080/pagina-care-nu-exista
* */

//14 functie de afisare a erorilor
function afisareEroare(res, identificator) {
    if (!obGlobal.erori) return res.status(500).send("Sistemul de erori nu este initializat.");
    //12. se creaza un template eroare.ejs
    //14. afisam in pagina
    const eroare = obGlobal.erori.find(e => e.identificator == identificator) || obGlobal.eroare_default;
    res.status(eroare.status || 500).render('partials/eroare', {
        titlu: eroare.titlu,
        text: eroare.text,
        imagine: eroare.imagine
    });
}
//compilare automata Scss cu backup
function compileazaScss(caleFisierScss) {
    if (!fs.existsSync(caleFisierScss)) {
        console.warn(`Atentie: Fisierul sursa SCSS nu a fost gasit: ${caleFisierScss}`);
        return;
    }
    const numeFisierScss = path.basename(caleFisierScss);
    console.log(`-> Incepe compilarea pentru: ${numeFisierScss}`);
    try {
        const rezultat = sass.compile(caleFisierScss, {
            sourceMap: true,
            loadPaths: [path.join(__dirname, 'node_modules')]
        });

        const numeFisierCss = numeFisierScss.replace(".scss", ".css");
        const caleFisierCss = path.join(obGlobal.folderCss, numeFisierCss);
        //backup fisier extern css
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

//rutele aplicatiei
//6. am creat un folder special cu toate erorile
//7. schimba caile fisierelor-sursa
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static(path.join(__dirname, 'html')));

//8. pagina index sa poata si cu index si 8080
app.get(['/', '/index'], (req, res) => {
    res.render('index', {
        ip: req.ip,
        title: 'The Vintage Mosaic',
        images: []
    });
});

//19. adaugam app.get() pt favicon
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/resurse/ico/favicon.ico'));
});

//18. la cererea unui fisier ejs transmitem 400 bad request
app.get('/*.ejs', (req, res) => {
    afisareEroare(res, 400);
});

//9. declaram app.get generic pentru /:pagina
app.get('/:pagina', (req, res, next) => {
    const calePagina = path.join(__dirname, 'views', `${req.params.pagina}.ejs`);
    if (fs.existsSync(calePagina)) {
        //16 afisarea IP-ului utilizatorului.
        res.render(req.params.pagina, {
            ip: req.ip,
            title: req.params.pagina.charAt(0).toUpperCase() + req.params.pagina.slice(1)
        });
    } else {
        // 10. in cazul in care pagina nu exista se va randa o pagina speciala de eroare 404
        // 'next()' pentru a ajunge la handler-ul de eroare de la final
        next();
    }
});

//10. middleware pt 404
app.use((req, res) => {
    afisareEroare(res, 404);
});

//compilare scss si pornire server monitorizare timp real
console.log("===================================================");
console.log("Incepe compilarea initiala a fisierelor SCSS...");
fs.readdirSync(obGlobal.folderScss).forEach(fisier => {
    // 3. am eliminat conditia care excludea 'galerie.scss'
    if (path.extname(fisier).toLowerCase() === ".scss") {
        compileazaScss(path.join(obGlobal.folderScss, fisier));
    }
});
console.log("Compilarea initiala a fost finalizata.");
console.log("===================================================");

fs.watch(obGlobal.folderScss, (eveniment, numeFisier) => {

    if (numeFisier && path.extname(numeFisier).toLowerCase() === ".scss") {
        console.log(`\n[WATCHER] Detectata o modificare (${eveniment}) in fisierul: ${numeFisier}`);
        setTimeout(() => compileazaScss(path.join(obGlobal.folderScss, numeFisier)), 200);
    }
});

app.listen(PORT, () => {
    console.log(`Serverul ruleaza la http://localhost:${PORT}`);
    console.log(`Pagina principala ar trebui sa fie acum 'html/index.html'`);
});

