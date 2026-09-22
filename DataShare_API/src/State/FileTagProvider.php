<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\File;
use App\Repository\FileRepository;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Loads the file the tag operations act on.
 *
 * The default Doctrine provider cannot be used on these routes, for two
 * independent reasons.
 *
 * On /files/{id}/tags/{tag}, LinksHandlerTrait consumes the URI variables by
 * shifting them off a list rather than by name. The {id} link would read
 * "facture", the integer transformer would cast it to 0, and the query would
 * silently look for a file that does not exist.
 *
 * On the POST, ReadProvider only turns a null read into a 404 for safe
 * methods. An unknown id would therefore reach the security expression as a
 * null object and fail with a 500 instead of the 404 the API contract
 * announces.
 *
 * Returning the file here also leaves {tag} untouched in the processors'
 * $uriVariables, which is the whole point of naming a tag in the URI.
 *
 * @implements ProviderInterface<File>
 */
final readonly class FileTagProvider implements ProviderInterface
{
    public function __construct(private FileRepository $fileRepository)
    {
    }

    /**
     * @param array<string, mixed> $uriVariables
     * @param array<string, mixed> $context
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): File
    {
        $id = $uriVariables['id'] ?? null;
        $file = is_numeric($id) ? $this->fileRepository->find((int) $id) : null;

        if (!$file instanceof File) {
            throw new NotFoundHttpException('Ce fichier n\'existe pas.');
        }

        return $file;
    }
}
