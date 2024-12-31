corpus-templater
================

Create template scores for OpenScore sub-projects like the Lieder Corpus.

Try it in a browser at <https://shoogle.github.io/corpus-templater/>.

All processing takes place in the browser via JavaScript. Nothing is uploaded.

## How it works

Your web browser downloads the corpus spreadsheet data as well as a MuseScore Studio project file.

Data from a specific row of the spreadsheet is inserted into the project file, replacing
placeholder values for things such as work title, movement title, composer, etc.

Your browser then prompts you to save the resulting template score somewhere on your device.

### Offline usage not supported

Owing to the security policies of most web browsers, the templater only works when it's accessed
via a proper HTTP or HTTPS web server, such as GitHub Pages.

If you instead save these source files to your local machine and try to open <index.html> directly
in your browser (i.e. via the `file://` protocol), although the page will render correctly, the
browser will not allow the script to fetch the spreadsheet data and MuseScore project file used to
construct templates.
