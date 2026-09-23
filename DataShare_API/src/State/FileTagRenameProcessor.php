<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\ApiResource\TagInput;
use App\Entity\File;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Renames a tag on one file: PUT /api/files/{id}/tags/{tag}.
 *
 * "On one file" is the whole decision, see docs/architectureDecisions/tags.md.
 * The tag is shared by every file of the account, so it is detached and a
 * second one attached in its place; the other files keep the old name.
 *
 * @implements ProcessorInterface<TagInput, File>
 */
final readonly class FileTagRenameProcessor implements ProcessorInterface
{
    use FileTagOperationTrait;

    /**
     * @param ProcessorInterface<File, File> $persistProcessor
     */
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private ProcessorInterface $persistProcessor,
        private TagResolver $tagResolver,
    ) {
    }

    /**
     * @param array<string, mixed> $uriVariables
     * @param array<string, mixed> $context
     */
    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): File
    {
        $file = $this->readFile($context);
        $owner = $this->ownerOf($file);
        $currentName = $uriVariables['tag'] ?? null;

        if (!is_string($currentName)) {
            // The route only matches when {tag} is present, so this would be a
            // misconfiguration rather than a client error.
            throw new \LogicException('The tag rename operation requires a tag URI variable.');
        }

        $tag = $file->findTag($currentName);

        if (null === $tag) {
            // Raised here and not in the provider: the provider runs before the
            // security expression, so a 404 there would reach a user who is not
            // the owner and let them probe other accounts' tags through the
            // difference between 403 and 404.
            throw new NotFoundHttpException(sprintf('The "%s" tag is not on this file.', $currentName));
        }

        $newName = trim((string) $data->tag);

        // Renaming a tag to the name it already has is a no-op, not an error.
        if ($newName !== $currentName) {
            if (null !== $file->findTag($newName)) {
                $this->rejectDuplicate($newName);
            }

            // Never $tag->setName(): the tag is shared by every file of the
            // account, renaming it in place would rename them all and could
            // collide with UNIQ_TAG_OWNER_NAME.
            $file->detachTag($tag);
            $file->addTag($this->tagResolver->resolve($owner, $newName));
        }

        return $this->persistProcessor->process($file, $operation, $uriVariables, $context);
    }
}
