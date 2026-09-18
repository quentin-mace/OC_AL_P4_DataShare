<?php

namespace App\State;

use App\Entity\File;
use App\Repository\FileRepository;
use Symfony\Component\HttpKernel\Exception\GoneHttpException;

final readonly class DownloadFileResolver
{
    public function __construct(private FileRepository $fileRepository)
    {
    }

    /**
     * Same 410 whether the token never existed or has expired: telling the
     * two apart would let a client probe which tokens were ever valid, the
     * same reasoning as the uniform 401 on POST /api/login.
     */
    public function resolve(mixed $downloadToken): File
    {
        if (!is_string($downloadToken)) {
            // The route only matches when {downloadToken} is present, so this
            // would signal a misconfiguration rather than a client error.
            throw new \LogicException('The download operation requires a downloadToken URI variable.');
        }

        $file = $this->fileRepository->findOneBy(['downloadToken' => $downloadToken]);

        if (!$file instanceof File || $file->getExpirationDate() < new \DateTimeImmutable()) {
            throw new GoneHttpException('Ce lien de telechargement est invalide ou a expire.');
        }

        return $file;
    }
}
