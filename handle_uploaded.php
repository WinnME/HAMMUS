<?php

$uploaddir = 'uploads/';

if ($_FILES) {
	$hash = key($_FILES);
	$filename = $_FILES[$hash]['name'];
	$type = $_FILES[$hash]['type'];
	$tmp_name = $_FILES[$hash]['tmp_name'];
	$error = $_FILES[$hash]['error'];
	$size = $_FILES[$hash]['size'];
	$checkok = false;

	$uploadfile = $uploaddir . basename($filename);
	
	if (sha1_file($tmp_name) == $hash) {
		move_uploaded_file($tmp_name, $uploadfile);
		$realfilename = explode("_", $filename, 2)[1];
		$parts = explode('v', explode("_", $filename, 2)[0], 2);
		if ($parts[1] == 0) {
			rename($uploadfile, $uploaddir . $realfilename);
		}
		echo json_encode(array('action' => 'fileupload', 'part' => $parts[0], 'status' => true));
	} else {
		echo json_encode(array('action' => 'fileupload', 'part' => $parts[0], 'status' => false));
	}

} else if ($_POST) {
	$fhandle = fopen($uploaddir.$_POST['filename'], 'a');
	for ($i = 0; $i <= $_POST['parts']; $i++) {
		$src_fn = $i.'v'.$_POST['parts'].'_'.$_POST['filename'];
		$temp = fopen($uploaddir.$src_fn, 'r');
		fwrite($fhandle, fread($temp, filesize($uploaddir.$src_fn)));
		fclose($temp);
		unlink(realpath($uploaddir.$src_fn));
	}
	fclose($fhandle);
	if (sha1_file($uploaddir.$_POST['filename']) == $_POST['hash']) {
		echo json_encode(array('action' => 'fileconcat', 'status' => true));
	} else {
		echo json_encode(array('action' => 'fileconcat', 'status' => false));
	}
} else {
	die('Systemfehler: fehlerhafter Aufruf');
}
?>