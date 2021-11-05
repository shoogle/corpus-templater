const url_query_string = new URLSearchParams(window.location.search);

const corpus = url_query_string.get('corpus');
const sid = url_query_string.get('sid');
const gid = url_query_string.get('gid');
const hrow = url_query_string.get('hrow');

const spreadsheet_url = "https://docs.google.com/spreadsheets/d/" + sid + "/export?gid=" + gid + "&format=csv";
//const spreadsheet_url = "https://cors-anywhere.herokuapp.com/" + spreadsheet_url; // use if CORS header missing
//const spreadsheet_url = "data/" + corpus + ".csv"; // use for offline development

document.title = "Corpus Templater: " + corpus
document.getElementById("corpus").innerHTML = corpus;
const headings_row = parseInt(hrow, 10);

let piece_row;
let pieces;
let pieces_request;
let has_lyricist = false;

function romanize(num)
{
    if (isNaN(num)) {
        return NaN;
    }
    var digits = String(+num).split(""),
        key = ["","C","CC","CCC","CD","D","DC","DCC","DCCC","CM",
               "","X","XX","XXX","XL","L","LX","LXX","LXXX","XC",
               "","I","II","III","IV","V","VI","VII","VIII","IX"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}

function replacements(piece)
{
    return Object.assign(
        replacements_generic(piece),
        replacements_song(piece),
        piece["Set"] === "[singles]"
            ? replacements_single(piece)
            : replacements_cycle(piece)
    );
}

function replacements_generic(piece)
{
    return {
        "{{Composer}}":             first_name_first(piece["Composer"]),
        "{{Composer abbr.}}":       abbreviate_artist_name(piece["Composer"]),
        "{{IMSLP Ref}}":            piece["IMSLP #"],
        "{{Today}}":                new Date().toISOString().substring(0, 10),
    }
}

function replacements_song(piece)
{
    return {
        "{{Lyricist Score}}":   has_lyricist ? lyricist(piece, true) : "",
        "{{Lyricist Prop}}":    has_lyricist ? lyricist(piece, false) : "",
    }
}

function replacements_single(piece)
{
    return {
        "{{Work Title}}":         piece["Piece / Movement"],
        "{{Movement Number}}":    "",
        "{{Mvt Title Prop}}":     "",
        "{{Mvt Title Score}}":    "Subtitle [optional, delete if not needed]",
        "<style>User-1</style>":  "<style>Title</style>",
        "<style>User-2</style>":  "<style>Subtitle</style>",
    }
}

function replacements_cycle(piece)
{
    // numbering: songs use Arabic numbers, movements use Roman numerals
    let num = has_lyricist ? piece["No."] : romanize(parseInt(piece["No."], 10))

    let commaIdx = piece["Set"].indexOf(", ");
    let running_header_title = "$:workNumber:"

    if (commaIdx < 0) {
        // piece has no work number
        commaIdx = piece["Set"].length;
        running_header_title = "$:workTitle:"
    }

    return {
        "{{Work Title}}":           piece["Set"],
        "{{Work Title Primary}}":   piece["Set"].substring(0, commaIdx),
        "{{Work Title Secondary}}": piece["Set"].substring(commaIdx + 2),
        "{{Running Header Title}}": running_header_title,
        "{{Movement Number}}":      num + piece["Subdivision"],
        "{{Mvt Title Prop}}":       piece["Piece / Movement"],
        "{{Mvt Title Score}}":      num + piece["Subdivision"] + ". " + piece["Piece / Movement"],
    };
}

function lyricist(piece, do_abbreviate_composer)
{
    if (piece["Lyricist IMSLP URL / name"].startsWith("Composer")) {
        return do_abbreviate_composer
            ? '(' + piece["Composer"].split(',')[0] + ')' // only surname
            : first_name_first(piece["Composer"]); // full name
    }
    return first_name_first(imslp_artist(piece["Lyricist IMSLP URL / name"]));
}

function first_name_first(name)
{
    let idx = name.indexOf(','); // first occurance
    if (idx === -1) {
        return name; // no comma in name
    }
    return name.substring(idx + 2) + " " + name.substring(0, idx);
}

function abbreviate_artist_name(name)
{
    // name = "Beethoven, Ludwig van";
    let commaIdx = name.indexOf(', '); // separator
    if (commaIdx === -1)
        return name;
    let abbr = '';
    name.substring(commaIdx + 2).split(" ").forEach((word, idx, words) => {
        if (word.match(/^\(.*\)$/)) { // maiden name of female composer
            if (idx > 0) {
                abbr += " "
            }
            abbr += word;
            if (idx + 1 < words.length) {
                abbr += " "
            }
        } else { // normal name
            abbr += word.substring(0, 1) + '.';
        }
    });
    return abbr + " " + name.substring(0, commaIdx);
}

function imslp_artist(url)
{
    let prefix = "https://imslp.org/wiki/Category:";
    if (!url.startsWith(prefix)) {
        return url; // not an IMSLP artist
    }
    return decodeURIComponent(url.substring(prefix.length)).replace(/_/g, ' ');
}

function if_not_equal(val, cmp)
{
    return val === cmp ? "" : val;
}

function spreadsheet_data_by_heading(table, headings_row=1)
{
    let headings = table[headings_row - 1]; // arrays are zero-indexed
    if (headings.includes("Lyricist IMSLP URL / name")) {
        has_lyricist = true;
    }
    rows = [];
    for (let entry of table.slice(headings_row)) {
        data = {};
        for (let i = 0; i < entry.length; i++) {
            data[headings[i]] = entry[i];
        }
        rows.push(data);
    }
    return rows;
}

function fetch_text_file(file, callback)
{
    return fetch(file)
        .then(response => response.text())
        .then(text => callback(text))
        .catch(error => console.error("Error:", error));
}

function download_text_file(filename, text) {
    let element = document.createElement('a');
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function process(pieces_sheet) {
    let table = $.csv.toArrays(pieces_sheet);
    pieces = spreadsheet_data_by_heading(table, headings_row);
}

async function proceed(text)
{
    await pieces_request;
    console.log("Creating template... (Row = " + piece_row + ")");
    let piece = pieces[piece_row - headings_row - 1]; // arrays are zero-indexed
    for (const [key, value] of Object.entries(replacements(piece))) {
        text = text.replace(new RegExp(key, 'g'), value);
    }
    let sep = " – "; // en dash (Unicode)
    let fname = piece["Composer"] + sep;
    if (corpus === "string-quartets") {
        fname += piece["Set"] + sep; // Set name is work name. All movements in one file.
    } else {
        if (piece["Set"] !== "[singles]") {
            fname += piece["Set"] + ", No." + piece["No."] + piece["Subdivision"] + sep;
        }
        fname += piece["Piece / Movement"] + sep;
    }
    fname += "TEMPLATE"
    console.log("Created template: " + fname);
    download_text_file(fname + ".mscx", text);
    console.info("Enter a new row number to create another template. Do not \
refresh the page unless you need to fetch an updated copy of the spreadsheet.");
}

function create()
{
    if (corpus === null || sid === null || gid === null || hrow === null) {
        console.error("Error: Must include 'corpus', 'sid', 'gid' and 'row' in URL query string.");
        return;
    }

    let rownum = document.getElementById('rownum').value;
    piece_row = parseInt(rownum, 10);

    if (!rownum || piece_row <= headings_row) {
        console.error("Error: Must specify a valid row number greater than " + headings_row);
        return;
    }

    if (pieces === undefined) {
        console.log("Fetching spreadsheet... This may take a few moments.");
        pieces_request = fetch_text_file(spreadsheet_url, process);
    }

    fetch_text_file("templates/" + corpus + ".mscx", proceed);
}
