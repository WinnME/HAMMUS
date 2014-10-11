if (window.File && window.FileReader && window.FileList && window.Blob && window.URL && window.Worker) {  
} else {
	alert('Der Browser unterstützt die benötighten Funktionen für den Dateiupload leider nicht!');
}

var max_filesize_per_upload = 0;
var max_filesize_per_upload_fallback = 1048576;
var retry_max = 5;

var ul_btn_height;

var pool = new Pool(4);

/*
Klassendefinitionen
*/

var uploadlist = {
	list : [],
	checkduplicate : function(hash) {
		var duplicate = false;
		if (this.list.length > 0) {
			this.list.forEach(function(item) {
				if (item.hash === hash) {
					duplicate = true;
				}
			});
		}
		return duplicate;
	},
	generateUUID : function(){
		var d = new Date().getTime();
		var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = (d + Math.random()*16)%16 | 0;
			d = Math.floor(d/16);
			return (c=='x' ? r : (r&0x7|0x8)).toString(16);
		});
		return uuid;
	},
	getHash : function(i) {
		if (this.list[i]) {
			return this.list[i].hash;
		} else {
			return false;
		}
	},
	getId : function(i) {
		if (this.list[i]) {
			return this.list[i].id;
		} else {
			return false;
		}
	},
	getIdFromHash : function(hash) {
		if (this.list.length > 0) {
			this.list.forEach(function(element) {
				if (element.hash == hash) {
					return element.id;
				}
			});
		} else {
			return false;
		}
	},
	getThumbDOM : function(id) {
		var dom = $('#list>#' + id);
		return (dom.length === 0) ? false : dom;
	},
	generateThumbDOM : function() {
		var randomId = this.generateUUID();
		
		var span = document.createElement('div');
		var spinner = document.createElement('img');
		var btn = svgicon('icon-remove');
		var spinner = svgicon('icon-spinner');
		
		btn.setAttribute('class', btn.getAttribute('class') + ' thumb_content thumb_icon thumb_button');
		spinner.setAttribute('class', spinner.getAttribute('class') + ' spinner');

		span.id = randomId;
		$(span).addClass('thumb').append(spinner).append(btn).click(handleRemoveItem).hide();
		
		return span;
	},
	addFile : function(f) {
		var span = this.generateThumbDOM();
		$(span).appendTo('#list').fadeIn();
		
		this.callHashWorker({command: 'hashfile', arguments: {id: span.id, file: f, maxPartSize: max_filesize_per_upload}}, this.handleAddItem({target: this, targetEl: span}));
	},
	handleAddItem : function(o) { return function(evt) {
		if (!o.target.getThumbDOM(evt.data.id)) {return;};
		if (!o.target.checkduplicate(evt.data.hash)) {
			var imageUrl = window.URL.createObjectURL(evt.data.file);
			o.target.list.push(evt.data);
			$(o.targetEl).css('background-image', 'Url(' + imageUrl + ')').addClass('thumb_border').hide().fadeIn().children('.spinner').fadeOut();
			$("#upload").fadeIn();
		} else {
			$(o.targetEl).fadeOut(function() {this.remove();});
			setLoadingTxt({txt: 'Datei: ' + evt.data.file.name + ' bereits vorhanden', error: true});
		}
	}},
	removeFile : function(id) {
		this.removeItem(id);
		
		var el = this.getThumbDOM(id);
		if (el) {
			el.fadeOut('normal', function() {
				this.remove();
				if (uploadlist.list.length === 0) $('#upload').fadeOut();
			});
		} else {
			setLoadingTxt({txt: 'Fehler beim Entfernen der Datei aus der Liste!', error: true});
		}
	},
	removeItem : function(id) {
		for(var i = 0; i < this.list.length; i++) {
			if (this.getId(i) === id) {
				this.list.splice(i,1);
				break;
			}
		}
	},
	callHashWorker : function(data, callback) {
		//var hashWorker = new Worker('hash_webworker.js');
		//hashWorker.onmessage = callback;
		//hashWorker.postMessage(data);
		pool.addWorkerTask(new WorkerTask('hash_webworker.js',callback,data));
	}
}

/*
Initilisierungen
*/

$(document).ready(function() {
	$.post('max_fs.php', function(){}, 'json')
	.done(function(data){
		if(data && data.maxFileSize) {
			max_filesize_per_upload = parseInt(data.maxFileSize);
		} else {
			max_filesize_per_upload = max_filesize_per_upload_fallback;
			setLoadingTxt({txt: 'Fehler beim Auslesen des Uploadlimits!<br>Fallback auf ' + (max_filesize_per_upload_fallback / 1024) + 'kb pro Upload', error: true});
		}
	})
	.fail(function(){
		max_filesize_per_upload = max_filesize_per_upload_fallback;
		setLoadingTxt({txt: 'Fehler beim Auslesen des Uploadlimits!<br>Fallback auf ' + (max_filesize_per_upload_fallback / 1024) + 'kb pro Upload', error: true});
	})
	.always(function() {
		/*DEBUG*/max_filesize_per_upload = 524288;
		start();
	});
});

function start() {
	$('#filesize').append(max_filesize_per_upload/1024/1024).append(' MiB');
	document.getElementById('files').addEventListener('change', handleFileSelect, false);
	document.getElementById('upload_queue').addEventListener('drop', handleFileSelect, false);
	document.getElementById('upload_queue').addEventListener('dragover', handleDragOver, false);
	document.getElementById('upload').addEventListener('click', handleUpload, false);
	pool.init();
	ul_btn_height = $('#upload').outerHeight();
}

/*
Logging & Messaging
*/

function setLoadingTxt(obj) {
	var el = $('aside');
	if (obj && obj.txt) {
	
		var stayOpen = obj.stayOpen || false;
		var isError = obj.error || false;
		var timeout = obj.timeout || 3000;
		var pos = obj.pos || false;

		if (isError) {
			el.addClass('red');
		} else {
			el.addClass('green');
		}

		el.html(obj.txt);
		el.addClass('show');

		if (!stayOpen) {
			window.setTimeout(setLoadingTxt, timeout);
		}
	} else {
		el.removeClass();
	}
}

/*
Event-Prozeduren
*/
	  
function handleDragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	evt.dataTransfer.dropEffect = 'copy';
}

function handleFileSelect(evt) {
	if (evt.type == "drop") {
		evt.stopPropagation();
		evt.preventDefault();
		var filelist = evt.dataTransfer.files;
	} else {
		var filelist = evt.target.files;
	}
	
	for (var i = 0, file; file = filelist[i]; i++) {
		uploadlist.addFile(file);
	}
	
	document.getElementById('files').value = '';
}

function handleRemoveItem(evt) {
	uploadlist.removeFile(this.id);
}

function handleUpload(evt) {
	$.each(uploadlist.list, function()
	{
			upload_file(this);
	});
}

/*
Dateiupload
*/

function upload_file(fileObject) {
	for(var i = 0; i < fileObject.parts.length; i++) {
		var progressbottom = i * (75 / (fileObject.parts.length)) * 100 / 75 ;	
		var progress = document.createElement('div')
		$(progress).addClass('progress').addClass('part_'+i).css('bottom', progressbottom + '%');
		uploadlist.getThumbDOM(fileObject.id).append(progress);
		var xhr = new XMLHttpRequest();
		ajax_partupload(i, fileObject);
	}
}

function ajax_partupload(i, fileObject) {
	if (fileObject.parts.length == 1) {
		var progressmax = 100;
	} else {
		var progressmax = (75 / (fileObject.parts.length)) * 100 / 75;
	}
	var data = new FormData();
	data.append(fileObject.parts[i].hash, fileObject.file.slice(fileObject.parts[i].begin, fileObject.parts[i].end), i + 'v' + (fileObject.parts.length - 1) + '_' + fileObject.file.name);
	var xhr = new XMLHttpRequest();
	xhr.open('POST', 'handle_uploaded.php', true);
	xhr.responseType = 'json';
	xhr.upload.onprogress = (function(i){ return function(e) {
		if (e.lengthComputable) {
			var gesamtfortschritt = (progressmax / 100 *(e.loaded / e.total * 100))
			uploadlist.getThumbDOM(fileObject.id).find('.progress.part_' + i).css('height', gesamtfortschritt + '%');
		}
	};})(i)
	xhr.onloadend = function() {
		if (this.status == 200 && this.response.status) {
			fileObject.parts[this.response.part].status = true;
			var l = 0;
			for (var i = 0; i < fileObject.parts.length; i++) if (fileObject.parts[i].status == true){l++};
			if (l == fileObject.parts.length) {
				if (fileObject.parts.length > 1) {
					ajax_concat(fileObject);
				} else {
					var btn = svgicon('icon-checkmark');
					btn.setAttribute('class', btn.getAttribute('class') + ' thumb_content thumb_icon');
					uploadlist.getThumbDOM(fileObject.id).append(btn).hide().fadeIn('fast');
					setTimeout(function() {uploadlist.removeFile(fileObject.id);}, 500);
				}
			}
		} else {
			var l = this.response.part;
			uploadlist.getThumbDOM(fileObject.id).find('.progress.part_' + this.response.part).addClass('progress_failed');
			fileObject.parts[this.response.part].ulcount++;
			if (fileObject.parts[this.response.part].ulcount <= retry_max) {
				setTimeout(function() {
					uploadlist.getThumbDOM(fileObject.id).find('.progress.part_' + l).removeClass('progress_failed');
					ajax_partupload(l, fileObject);
				}, 500);
			} else {
				var btn = svgicon('icon-close');
				btn.setAttribute('class', btn.getAttribute('class') + ' thumb_content thumb_icon');
				uploadlist.getThumbDOM(fileObject.id).append(btn).hide().fadeIn('fast');
				setTimeout(function() {
					uploadlist.getThumbDOM(fileObject.id).find('.progress').fadeOut('fast', function() {this.remove();});
					$(btn).fadeOut('fast', function() {this.remove();});
					setTimeout(function() {uploadlist.removeFile(fileObject.id);}, 500);
				}, 500);
			}
		}
	}
	xhr.send(data);
}

function ajax_concat(fileObject) {
	var data = new FormData();
	data.append('filename', fileObject.file.name);
	data.append('parts', (fileObject.parts.length - 1));
	data.append('hash', fileObject.hash);

	var xhr = new XMLHttpRequest();
	xhr.open('POST', 'handle_uploaded.php', true);
	xhr.responseType = 'json';
	xhr.onloadend = function() {
		if (this.status == 200 && this.response.status) {
			var btn = svgicon('icon-checkmark');
			btn.setAttribute('class', btn.getAttribute('class') + ' thumb_content thumb_icon');
			uploadlist.getThumbDOM(fileObject.id).append(btn).hide().fadeIn('fast');
			setTimeout(function() {uploadlist.removeFile(fileObject.id);}, 500);
		} else {
			var btn = svgicon('icon-close');
			btn.setAttribute('class', btn.getAttribute('class') + ' thumb_content thumb_icon');
			uploadlist.getThumbDOM(fileObject.id).append(btn).hide().fadeIn('fast');
			setTimeout(function() {
				uploadlist.getThumbDOM(fileObject.id).find('.progress').fadeOut('fast', function() {this.remove();});
				$(btn).fadeOut('fast', function() {this.remove();});
				fileObject.parts.forEach(function(element) {
					element.status = false;
				});
				fileObject.ulcount++;
				if (fileObject.ulcount <= retry_max) {
					upload_file(fileObject);
				} else {
					setTimeout(function() {uploadlist.removeFile(fileObject.id);}, 500);
				}
			}, 500);
		}
	};
	xhr.send(data);
}

/*
	Helferfunktionen
*/

function svgicon(name) {
	var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
	
	svg.setAttribute('class', name);
	svg.setAttributeNS(null, 'viewBox', '0 0 32 32');
	use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + name );
	
	svg.appendChild(use);
	return svg;
}

function Pool(size) {
    var _this = this;
    this.taskQueue = [];
    this.workerQueue = [];
    this.poolSize = size;
 
    this.addWorkerTask = function(workerTask) {
        if (_this.workerQueue.length > 0) {
            var workerThread = _this.workerQueue.shift();
            workerThread.run(workerTask);
        } else {
            _this.taskQueue.push(workerTask);
        }
    }
    this.init = function() {
        for (var i = 0 ; i < size ; i++) {
            _this.workerQueue.push(new WorkerThread(_this));
        }
    }
    this.freeWorkerThread = function(workerThread) {
        if (_this.taskQueue.length > 0) {
            var workerTask = _this.taskQueue.shift();
            workerThread.run(workerTask);
        } else {
            _this.taskQueue.push(workerThread);
        }
    }
}
function WorkerThread(parentPool) {
    var _this = this;
    this.parentPool = parentPool;
    this.workerTask = {};
 
    this.run = function(workerTask) {
        this.workerTask = workerTask;
        if (this.workerTask.script!= null) {
            var worker = new Worker(workerTask.script);
            worker.addEventListener('message', dummyCallback, false);
            worker.postMessage(workerTask.startMessage);
        }
    }
 
    function dummyCallback(event) {
        _this.workerTask.callback(event);
        _this.parentPool.freeWorkerThread(_this);
    }
 
}
function WorkerTask(script, callback, msg) {
    this.script = script;
    this.callback = callback;
    this.startMessage = msg;
};