<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\ApiResource\FileUploadInput;
use App\Entity\File;
use App\Entity\User;
use App\Enum\FileType;
use League\Flysystem\FilesystemOperator;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;

/**
 * Writes the uploaded file to storage, builds the File entity, then hands it
 * over to the regular Doctrine persist processor.
 *
 * @implements ProcessorInterface<FileUploadInput, File>
 */
final readonly class FileUploadProcessor implements ProcessorInterface
{
    private const int DEFAULT_EXPIRATION_IN_DAYS = 7;

    /**
     * @param ProcessorInterface<File, File> $persistProcessor
     */
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private ProcessorInterface $persistProcessor,
        #[Autowire(service: 'default.storage')]
        private FilesystemOperator $storage,
        private PasswordHasherInterface $passwordHasher,
        private TagResolver $tagResolver,
        private Security $security,
    ) {
    }

    /**
     * @param array<string, mixed> $uriVariables
     * @param array<string, mixed> $context
     */
    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): File
    {
        $owner = $this->security->getUser();
        if (null !== $owner && !$owner instanceof User) {
            // A null user is the anonymous upload of US07. Anything else than
            // a User would mean the firewall was wired to another user class,
            // a misconfiguration rather than a client error.
            throw new \LogicException('The file upload operation cannot resolve the authenticated user.');
        }

        $uploadedFile = $data->file;
        if (!$uploadedFile instanceof UploadedFile) {
            // Assert\NotNull on FileUploadInput::$file guarantees this never happens.
            throw new \LogicException('The file upload operation requires a file.');
        }

        $storageKey = $this->generateStorageKey($uploadedFile->getClientOriginalExtension());
        // The server-guessed getMimeType() would require the symfony/mime
        // component, not otherwise a project dependency; the client-declared
        // type is the same trust level already accepted for the extension.
        $mimeType = $uploadedFile->getClientMimeType();

        $stream = fopen($uploadedFile->getPathname(), 'r');
        if (false === $stream) {
            throw new \RuntimeException(sprintf('Could not open the uploaded file "%s" for reading.', $uploadedFile->getPathname()));
        }

        try {
            $this->storage->writeStream($storageKey, $stream);
        } finally {
            fclose($stream);
        }

        $file = new File();
        $file->setName($uploadedFile->getClientOriginalName());
        $file->setMimeType($mimeType);
        $file->setType(FileType::fromMimeType($mimeType));
        $file->setSize($uploadedFile->getSize());
        $file->setStorageKey($storageKey);
        $file->setDownloadToken($this->generateDownloadToken());
        $file->setUploadDate(new \DateTimeImmutable());
        $file->setExpirationDate(
            (new \DateTimeImmutable())->modify(sprintf('+%d days', $data->expiresInDays ?? self::DEFAULT_EXPIRATION_IN_DAYS)),
        );
        // Null for an anonymous upload, see US07.
        $file->setOwner($owner);

        if (null !== $data->password) {
            $file->setPassword($this->passwordHasher->hash($data->password));
        }

        if ([] !== $data->tags && null === $owner) {
            // AuthenticatedOnly on FileUploadInput::$tags answers 422 long
            // before this point; the guard only makes sure a tag is never
            // silently dropped should that constraint ever be removed.
            throw new \LogicException('Tags cannot be attached to an anonymous upload.');
        }

        foreach ($data->tags as $tagName) {
            $file->addTag($this->tagResolver->resolve($owner, $tagName));
        }

        return $this->persistProcessor->process($file, $operation, $uriVariables, $context);
    }

    private function generateStorageKey(string $extension): string
    {
        $key = bin2hex(random_bytes(16));

        return '' === $extension ? $key : "{$key}.{$extension}";
    }

    private function generateDownloadToken(): string
    {
        return bin2hex(random_bytes(16));
    }
}
