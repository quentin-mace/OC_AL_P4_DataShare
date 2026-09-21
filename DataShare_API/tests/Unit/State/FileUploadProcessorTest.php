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
use League\Flysystem\FilesystemOperator;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
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
            $this->tagRepository($owner, []),
            $this->securityFor($owner),
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
            $this->tagRepository($owner, []),
            $this->securityFor($owner),
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
            $this->tagRepository($owner, []),
            $this->securityFor($owner),
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
            $this->tagRepository($owner, []),
            $this->securityFor($owner),
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
            $this->tagRepository($owner, []),
            $this->securityFor($owner),
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
            $this->tagRepository($owner, [$existingTag]),
            $this->securityFor($owner),
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
            $this->tagRepository($owner, []),
            $this->securityFor($owner),
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
            $this->tagRepository($owner, []),
            $this->securityFor($owner),
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
            $this->createStub(TagRepository::class),
            $this->securityFor(null),
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
            $this->createStub(TagRepository::class),
            $this->securityFor(null),
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
            $this->createStub(TagRepository::class),
            $security,
        );

        $this->expectException(\LogicException::class);

        $processor->process($this->uploadInput(), new Post());
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
     * @param list<Tag> $existingTags
     */
    private function tagRepository(User $owner, array $existingTags): TagRepository
    {
        $repository = $this->createStub(TagRepository::class);
        $repository->method('findOneBy')->willReturnCallback(
            static fn (array $criteria): ?Tag => current(array_filter(
                $existingTags,
                static fn (Tag $tag): bool => $tag->getName() === $criteria['name'] && $tag->getOwner() === $criteria['owner'],
            )) ?: null,
        );

        return $repository;
    }

    private function securityFor(?User $owner): Security
    {
        $security = $this->createStub(Security::class);
        $security->method('getUser')->willReturn($owner);

        return $security;
    }
}
