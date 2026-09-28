<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\File;
use League\Flysystem\FilesystemOperator;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Removes the stored object and the tags no other file carries, then hands the
 * entity over to the regular Doctrine remove processor.
 *
 * @implements ProcessorInterface<File, void>
 */
final readonly class FileDeleteProcessor implements ProcessorInterface
{
    /**
     * @param ProcessorInterface<File, void> $removeProcessor
     */
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.remove_processor')]
        private ProcessorInterface $removeProcessor,
        #[Autowire(service: 'default.storage')]
        private FilesystemOperator $storage,
    ) {
    }

    /**
     * @param array<string, mixed> $uriVariables
     * @param array<string, mixed> $context
     */
    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): void
    {
        $storageKey = $data->getStorageKey();
        if (null === $storageKey) {
            // The column is not nullable and the upload always fills it.
            throw new \LogicException('The file deletion operation requires a stored object.');
        }

        // Object first, row second, the same order the upload uses. Should the
        // flush fail, the row is left pointing at a deleted object: the file
        // still shows up in the history and the user can simply delete it
        // again. The other order would leave an object in MinIO that nothing
        // references anymore, so nothing could ever reclaim it.
        //
        // A missing object is not an error: the S3 API answers 204 on an
        // unknown key, which is what makes this route work on an expired file
        // whose object the automatic purge (US10) already removed while
        // keeping its history row.
        $this->storage->delete($storageKey);

        // Removing the file empties the join table, but says nothing to the tag
        // table: a tag its last file just dropped would survive as a row no
        // route can ever reach again. detachTag() removes it from its owner,
        // whose $tags collection is orphanRemoval, so the flush below deletes
        // it. Iterating over a copy, since detachTag() empties the collection
        // as it goes.
        foreach ($data->getTags()->toArray() as $tag) {
            $data->detachTag($tag);
        }

        $this->removeProcessor->process($data, $operation, $uriVariables, $context);
    }
}
