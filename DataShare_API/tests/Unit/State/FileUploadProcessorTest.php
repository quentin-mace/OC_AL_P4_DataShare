<?php

namespace App\Tests\Unit\State;

use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\ApiResource\FileUploadInput;
use App\Entity\File;
use App\Entity\Tag;
use App\Entity\User;
use App\Repository\TagRepository;
use App\State\FileUploadProcessor;
use App\State\TagResolver;
use League\Flysystem\FilesystemOperator;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[CoversClass(FileUploadProcessor::class)]
final class FileUploadProcessorTest extends TestCase
{
    private const string OWNER_EMAIL = 'alice@example.com';

    private string $uploadedFilePath;

    protected function setUp(): void
    {
        $this->uploadedFilePath = tempnam(sys_get_temp_dir(), 'upload-test-');
        file_put_contents($this->uploadedFilePath, 'contenu du fichier');
    }

    protected function tearDown(): void
    {
        @unlink($this->uploadedFilePath);
    }

    public function testItWritesTheFileToStorageAndBuildsTheEntity(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);

        $storage = $this->createMock(FilesystemOperator::class);
        $storage->expects($this->once())
            ->method('writeStream')
            ->with(
                $this->callback(static fn (mixed $value): bool => is_string($value)),
                $this->callback(static fn (mixed $value): bool => is_resource($value)),
            );

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $storage,
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            new NullLogger(),
        );

        $file = $processor->process($this->uploadInput(), new Post());

        self::assertSame('rapport.pdf', $file->getName());
        self::assertSame('application/pdf', $file->getMimeType());
        self::assertSame($owner, $file->getOwner());
        self::assertNotNull($file->getDownloadToken());
        self::assertNotNull($file->getStorageKey());
        self::assertStringEndsWith('.pdf', $file->getStorageKey());
    }

    /**
     * The size and the storage write duration are the two figures PERF.md is
     * built on, and this is the only place that knows either of them.
     */
    public function testItLogsTheStoredSizeAndWriteDuration(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->once())
            ->method('info')
            ->with(
                'file.stored',
                $this->callback(static function (mixed $context): bool {
                    self::assertIsArray($context);
                    self::assertSame(strlen('contenu du fichier'), $context['size_bytes']);
                    self::assertIsFloat($context['storage_write_ms']);
                    self::assertSame('application/pdf', $context['mime_type']);
                    self::assertFalse($context['anonymous']);

                    return true;
                }),
            );

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $this->createStub(FilesystemOperator::class),
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            $logger,
        );

        $processor->process($this->uploadInput(), new Post());
    }

    /**
     * Two uploads must never collide on the same object key, even for the
     * same original file name.
     */
    public function testItGeneratesADifferentStorageKeyAndDownloadTokenPerUpload(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);
        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $this->createStub(FilesystemOperator::class),
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            new NullLogger(),
        );

        $first = $processor->process($this->uploadInput(), new Post());
        $second = $processor->process($this->uploadInput(), new Post());

        self::assertNotSame($first->getStorageKey(), $second->getStorageKey());
        self::assertNotSame($first->getDownloadToken(), $second->getDownloadToken());
    }

    public function testItDefaultsTheExpirationToSevenDaysWhenNoneIsSubmitted(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);
        $input = $this->uploadInput();
        $input->expiresInDays = null;

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $this->createStub(FilesystemOperator::class),
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            new NullLogger(),
        );

        $file = $processor->process($input, new Post());

        $expectedExpiration = (new \DateTimeImmutable())->modify('+7 days');
        self::assertEqualsWithDelta(
            $expectedExpiration->getTimestamp(),
            $file->getExpirationDate()?->getTimestamp(),
            5,
        );
    }

    public function testItHashesThePasswordWhenSubmitted(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);
        $input = $this->uploadInput();
        $input->password = 'secret';

        $hasher = $this->createMock(PasswordHasherInterface::class);
        $hasher->expects($this->once())
            ->method('hash')
            ->with('secret')
            ->willReturn('hashed-secret');

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $this->createStub(FilesystemOperator::class),
            $hasher,
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            new NullLogger(),
        );

        $file = $processor->process($input, new Post());

        self::assertTrue($file->isPasswordProtected());
        self::assertSame('hashed-secret', $file->getPassword());
    }

    public function testItLeavesTheFileUnprotectedWhenNoPasswordIsSubmitted(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);

        $hasher = $this->createMock(PasswordHasherInterface::class);
        $hasher->expects($this->never())->method('hash');

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $this->createStub(FilesystemOperator::class),
            $hasher,
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            new NullLogger(),
        );

        $file = $processor->process($this->uploadInput(), new Post());

        self::assertFalse($file->isPasswordProtected());
    }

    public function testItReusesAnExistingTagOfTheSameOwnerInsteadOfCreatingADuplicate(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);
        $existingTag = (new Tag())->setName('facture')->setOwner($owner);

        $input = $this->uploadInput();
        $input->tags = ['facture'];

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $this->createStub(FilesystemOperator::class),
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver($owner, [$existingTag]),
            $this->securityFor($owner),
            new NullLogger(),
        );

        $file = $processor->process($input, new Post());

        self::assertSame([$existingTag], $file->getTags()->toArray());
    }

    public function testItCreatesANewTagWhenTheOwnerHasNoneOfThatNameYet(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);

        $input = $this->uploadInput();
        $input->tags = ['facture'];

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $this->createStub(FilesystemOperator::class),
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            new NullLogger(),
        );

        $file = $processor->process($input, new Post());

        self::assertCount(1, $file->getTags());
        self::assertSame('facture', $file->getTags()->first()->getName());
        self::assertSame($owner, $file->getTags()->first()->getOwner());
    }

    public function testItDelegatesPersistenceToTheNativeDoctrineProcessor(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);

        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects($this->once())
            ->method('process')
            ->with($this->isInstanceOf(File::class))
            ->willReturnArgument(0);

        $processor = new FileUploadProcessor(
            $persistProcessor,
            $this->createStub(FilesystemOperator::class),
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            new NullLogger(),
        );

        $processor->process($this->uploadInput(), new Post());
    }

    /**
     * An anonymous upload is a complete upload, not a degraded one: only the
     * owner is missing.
     */
    public function testItLeavesTheOwnerNullForAnAnonymousUpload(): void
    {
        $storage = $this->createMock(FilesystemOperator::class);
        $storage->expects($this->once())->method('writeStream');

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $storage,
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver(new User(), []),
            $this->securityFor(null),
            new NullLogger(),
        );

        $file = $processor->process($this->uploadInput(), new Post());

        self::assertNull($file->getOwner());
        self::assertSame('rapport.pdf', $file->getName());
        self::assertNotNull($file->getStorageKey());
        self::assertNotNull($file->getDownloadToken());
    }

    /**
     * Tag::$owner is not nullable, so a tag without an account could not even
     * be persisted. AuthenticatedOnly answers 422 long before this guard.
     */
    public function testItRefusesToAttachTagsToAnAnonymousUpload(): void
    {
        $input = $this->uploadInput();
        $input->tags = ['facture'];

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $this->createStub(FilesystemOperator::class),
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver(new User(), []),
            $this->securityFor(null),
            new NullLogger(),
        );

        $this->expectException(\LogicException::class);

        $processor->process($input, new Post());
    }

    /**
     * Null is the anonymous case, but any other user class would mean the
     * firewall is wired to a provider this processor cannot work with.
     */
    public function testItRejectsAnAuthenticatedPrincipalThatIsNotAUser(): void
    {
        $security = $this->createStub(Security::class);
        $security->method('getUser')->willReturn($this->createStub(UserInterface::class));

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $this->createStub(FilesystemOperator::class),
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver(new User(), []),
            $security,
            new NullLogger(),
        );

        $this->expectException(\LogicException::class);

        $processor->process($this->uploadInput(), new Post());
    }

    /**
     * The object reaches the storage before any row references it, so a
     * failure after the write would leave bytes nothing can ever reclaim:
     * neither the history nor the expiry purge, both starting from the row.
     */
    public function testItRemovesTheStoredObjectWhenPersistingFails(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);

        $writtenKey = null;
        $deletedKey = null;

        $storage = $this->createMock(FilesystemOperator::class);
        $storage->method('writeStream')->willReturnCallback(
            static function (string $key) use (&$writtenKey): void {
                $writtenKey = $key;
            },
        );
        $storage->expects($this->once())->method('delete')->willReturnCallback(
            static function (string $key) use (&$deletedKey): void {
                $deletedKey = $key;
            },
        );

        $failingPersist = $this->createStub(ProcessorInterface::class);
        $failingPersist->method('process')->willThrowException(new \RuntimeException('insert failed'));

        $processor = new FileUploadProcessor(
            $failingPersist,
            $storage,
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            new NullLogger(),
        );

        try {
            $processor->process($this->uploadInput(), new Post());
            self::fail('The processor was expected to rethrow the persistence failure.');
        } catch (\RuntimeException $failure) {
            self::assertSame('insert failed', $failure->getMessage());
        }

        self::assertNotNull($writtenKey);
        // The object removed has to be the one just written, not merely "an"
        // object: a mismatch would delete someone else's file.
        self::assertSame($writtenKey, $deletedKey);
    }

    /**
     * A failed cleanup must not replace the error that caused it: the caller
     * needs to see why the upload failed, not why the tidying up did.
     */
    public function testItReportsTheOriginalFailureWhenTheCleanupAlsoFails(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);

        $storage = $this->createStub(FilesystemOperator::class);
        $storage->method('delete')->willThrowException(new \RuntimeException('storage unreachable'));

        $failingPersist = $this->createStub(ProcessorInterface::class);
        $failingPersist->method('process')->willThrowException(new \RuntimeException('insert failed'));

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->once())
            ->method('error')
            ->with('file.orphaned', $this->anything());

        $processor = new FileUploadProcessor(
            $failingPersist,
            $storage,
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            $logger,
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('insert failed');

        $processor->process($this->uploadInput(), new Post());
    }

    /**
     * The MIME type is a client-controlled header that only picks an icon, so
     * an oversized one falls back instead of failing the whole upload.
     */
    public function testItFallsBackOnAnOversizedMimeType(): void
    {
        $owner = (new User())->setEmail(self::OWNER_EMAIL);

        $input = new FileUploadInput();
        $input->file = new UploadedFile($this->uploadedFilePath, 'rapport.pdf', 'text/'.str_repeat('x', 300), test: true);

        $processor = new FileUploadProcessor(
            $this->passthroughPersistProcessor(),
            $this->createStub(FilesystemOperator::class),
            $this->createStub(PasswordHasherInterface::class),
            $this->tagResolver($owner, []),
            $this->securityFor($owner),
            new NullLogger(),
        );

        $file = $processor->process($input, new Post());

        self::assertSame('application/octet-stream', $file->getMimeType());
    }

    private function uploadInput(): FileUploadInput
    {
        $input = new FileUploadInput();
        $input->file = new UploadedFile($this->uploadedFilePath, 'rapport.pdf', 'application/pdf', test: true);
        $input->expiresInDays = '3';

        return $input;
    }

    private function passthroughPersistProcessor(): ProcessorInterface
    {
        $processor = $this->createStub(ProcessorInterface::class);
        $processor->method('process')->willReturnArgument(0);

        return $processor;
    }

    /**
     * TagResolver is final readonly, so it cannot be doubled: the real one is
     * built over a stubbed repository, as DownloadProcessorTest does with
     * DownloadFileResolver.
     *
     * @param list<Tag> $existingTags
     */
    private function tagResolver(User $owner, array $existingTags): TagResolver
    {
        $repository = $this->createStub(TagRepository::class);
        $repository->method('findOneBy')->willReturnCallback(
            static fn (array $criteria): ?Tag => current(array_filter(
                $existingTags,
                static fn (Tag $tag): bool => $tag->getName() === $criteria['name'] && $tag->getOwner() === $criteria['owner'],
            )) ?: null,
        );

        return new TagResolver($repository);
    }

    private function securityFor(?User $owner): Security
    {
        $security = $this->createStub(Security::class);
        $security->method('getUser')->willReturn($owner);

        return $security;
    }
}
