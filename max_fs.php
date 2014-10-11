<?php
error_reporting(0);

function return_bytes ($size_str)
{
    switch (substr ($size_str, -1))
    {
        case 'M': case 'm': return (int)$size_str * 1048576;
        case 'K': case 'k': return (int)$size_str * 1024;
        case 'G': case 'g': return (int)$size_str * 1073741824;
        default: return false;
    }
}

$upload_max_filesize = return_bytes(get_cfg_var('upload_max_filesize'));
$post_max_size = return_bytes(get_cfg_var('post_max_size'));

if (is_int($upload_max_filesize) && is_int($post_max_size)) {
	$maxFileSize = $upload_max_filesize < $post_max_size ? $upload_max_filesize : $post_max_size;
} else {
	$maxFileSize = false;
}

echo json_encode(array('maxFileSize' => $maxFileSize));
?>