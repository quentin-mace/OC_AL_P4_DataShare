<?php

namespace App\Enum;

enum FileType: string
{
    case Image = 'image';
    case Video = 'video';
    case Audio = 'audio';
    case Document = 'document';
    case Archive = 'archive';
    case Other = 'other';
}
