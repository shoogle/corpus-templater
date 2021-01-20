const url_query_string = new URLSearchParams(window.location.search);

const sid = url_query_string.get('sid');
const gid = url_query_string.get('gid');


const spreadsheet_url = "https://docs.google.com/spreadsheets/d/" + sid + "/export?gid=" + gid + "&format=csv";
//const spreadsheet_url = "https://cors-anywhere.herokuapp.com/ + spreadsheet_url; // use if CORS header missing
//const spreadsheet_url = "songs.csv";

const headings_row = 4;

let song_row;
let songs;
let songs_request;

function replacements(song)
{
    return Object.assign(
        replacements_generic(song),
        song["Set"] === "[singles]"
            ? replacements_single(song)
            : replacements_cycle(song)
    );
}

function replacements_generic(song)
{
    return {
        "{{Composer}}":           first_name_first(song["Composer"]),
        "{{Lyricist Score}}":     lyricist(song, true),
        "{{Lyricist Prop}}":      lyricist(song, false),
        "{{Movement Number}}":    song["No."] + song["Subdivision"],
        "{{IMSLP Ref}}":          song["IMSLP Edition #"],
        "{{Today}}":              new Date().toISOString().substring(0, 10),
    }
}

function replacements_single(song)
{
    return {
        "{{Work Title}}":         song["Song / Movement Title"],
        "{{Mvt Title Prop}}":     "",
        "{{Mvt Title Score}}":    "Subtitle [optional, delete if not needed]",
        "<style>User-1</style>":  "<style>Title</style>",
        "<style>User-2</style>":  "<style>Subtitle</style>",
    }
}

function replacements_cycle(song)
{
    return {
        "{{Work Title}}":         song["Set"],
        "{{Mvt Title Prop}}":     song["Song / Movement Title"],
        "{{Mvt Title Score}}":    song["No."] + song["Subdivision"] + ". " + song["Song / Movement Title"],
    }
}

function lyricist(song, do_abbreviate_composer)
{
    if (song["IMSLP URL / name"].startsWith("Composer")) {
        return do_abbreviate_composer
            ? '(' + song["Composer"].split(',')[0] + ')' // only surname
            : first_name_first(song["Composer"]); // full name
    }
    return first_name_first(imslp_artist(song["IMSLP URL / name"]));
}

function first_name_first(name)
{
    let idx = name.indexOf(','); // first occurance
    if (idx === -1) {
        return name; // no comma in name
    }
    return name.substring(idx + 2) + " " + name.substring(0, idx);
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

function process(songs_sheet) {
    let table = $.csv.toArrays(songs_sheet);
    songs = spreadsheet_data_by_heading(table, headings_row);
}

async function proceed(text)
{
    await songs_request;
    console.log("Creating template... (Row = " + song_row + ")");
    let song = songs[song_row - headings_row - 1]; // arrays are zero-indexed
    for (const [key, value] of Object.entries(replacements(song))) {
        text = text.replace(new RegExp(key, 'g'), value);
    }
    let sep = " – "; // en dash (Unicode)
    let fname = song["Composer"] + sep;
    if (song["Set"] !== "[singles]") {
        fname += song["Set"] + ", No." + song["No."] + song["Subdivision"] + sep;
    }
    fname += song["Song / Movement Title"];
    console.log("Created template: " + fname);
    download_text_file(fname + ".mscx", text);
    console.info("Enter a new row number to create another template. Do not \
refresh the page unless you need to fetch an updated copy of the spreadsheet.");
}

function create()
{
    if (sid === null || gid === null) {
        console.error("Error: Must include 'sid' and 'gid' in URL query string.");
        return;
    }

    let rownum = document.getElementById('rownum').value;
    song_row = parseInt(rownum, 10);

    if (!rownum || song_row <= headings_row) {
        console.error("Error: Must specify a valid row number greater than " + headings_row);
        return;
    }

    if (songs === undefined) {
        console.log("Fetching spreadsheet... This may take a few moments.");
        songs_request = fetch_text_file(spreadsheet_url, process);
    }

    fetch_text_file("src/lieder_template.mscx", proceed);
}
