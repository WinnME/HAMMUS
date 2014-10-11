importScripts('sha1.js', 'lib-typedarrays-min.js');

/*
	Helferfunktionen
*/

function numFilePartsMaxSize(Gesamt, maxTeil) { return Math.floor(Gesamt / maxTeil); }
function lastFilePartSize(Gesamt, maxTeil) { return (Gesamt - (numFilePartsMaxSize(Gesamt, maxTeil) * maxTeil)); }
function splitFile(oBlob, maxTeil) {
	var result = [];
	var i;
	var fullshare = (maxTeil * 100 / oBlob.size);
	var lfps = lastFilePartSize(oBlob.size, maxTeil);
	
	for (i = 0; i < numFilePartsMaxSize(oBlob.size, maxTeil); i++) {
		result.push({ begin: (i * maxTeil), end: ((i + 1) * maxTeil), status: false, anteil: fullshare, ulcount: 0 });
	}
	
	if (lfps > 0) {
		result.push({ begin: (i * maxTeil), end: (i * maxTeil + lfps), status: false, anteil: (lfps * 100 / oBlob.size), ulcount: 0 });
	}
	
	return result;
}

/*
	Worker
*/

function work(e) {
	var data = e.data;
	switch (data.command) {
		case 'hashblob':
			self.postMessage(hashblob(data));
			self.close();
			break;
		
		case 'hashfile':
			self.postMessage(hashfile(data));
			self.close();
			break;
	}
}

function hashblob(data) {
	var reader = new FileReaderSync();
	var hash = CryptoJS.SHA1(CryptoJS.lib.WordArray.create(reader.readAsArrayBuffer(data.arguments.file))).toString();
	return {filename: data.arguments.file.name, hash: hash};
}

function hashfile(data) {
	var reader = new FileReaderSync();
	result = {id: data.arguments.id, file: data.arguments.file, hash: CryptoJS.SHA1(CryptoJS.lib.WordArray.create(reader.readAsArrayBuffer(data.arguments.file))).toString(), parts: splitFile(data.arguments.file, data.arguments.maxPartSize), ulcount: 0}
	result.parts.forEach(function(element) {
		var reader = new FileReaderSync();
		element.hash = CryptoJS.SHA1(CryptoJS.lib.WordArray.create(reader.readAsArrayBuffer( data.arguments.file.slice(element.begin, element.end) ))).toString();
	});
	return result;
}

/*
	Events
*/

self.addEventListener('message', work, false);

/*
INPUT 1 {command: 'hashblob', arguments: {file: [Object]}}
OUTPUT 1 {filename: 'Dateiname', hash: 'Dateihash'}

INPUT 2 {command: 'hashfile', arguments: {file: [object], maxPartSize: bytes}}
OUTPUT 2 {id: '', file: [file], name: '', hash: '', parts: [PARTS], ulcount: 0}
PARTS {anteil: 0, status: false, begin: 0, end: 0, hash: '', ulcount: 0}

*/