<?php

namespace App\Tests\Unit\State;

use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use ApiPlatform\Validator\Exception\ValidationException;
use App\ApiResource\TagInput;
use App\Entity\File;
use App\Entity\Tag;
use App\Entity\User;
use App\Repository\TagRepository;
use App\State\FileTagAddProcessor;
use App\State\TagResolver;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(FileTagAddProcessor::class)]
final class FileTagAddProcessorTest extends TestCase
{
    public function testItAttachesANewTagToTheFile(): void
    {
        $owner = new User();
        $file = (new File())->setOwner($owner);

        $processed = $this->processor($owner, [])->process(
            $this->input('facture'),
            new Post(),
            context: ['read_data' => $file],
        );

        self::assertSame($file, $processed);
        self::assertSame(['facture'], $file->getTagNames());
        self::assertSame($owner, $file->getTags()->first()->getOwner());
    }

    public function testItReusesAnExistingTagOfTheOwner(): void
    {
        $owner = new User();
        $existing = (new Tag())->setName('facture')->setOwner($owner);
        $file = (new File())->setOwner($owner);

        $this->processor($owner, [$existing])->process(
            $this->input('facture'),
            new Post(),
            context: ['read_data' => $file],
        );

        self::assertSame($existing, $file->getTags()->first());
    }

    public function testItTrimsTheSubmittedTag(): void
    {
        $owner = new User();
        $file = (new File())->setOwner($owner);

        $this->processor($owner, [])->process(
            $this->input('  facture  '),
            new Post(),
            context: ['read_data' => $file],
        );

        self::assertSame(['facture'], $file->getTagNames());
    }

    public function testItRejectsATagAlreadyOnTheFile(): void
    {
        $owner = new User();
        $file = (new File())->setOwner($owner);
        $file->addTag((new Tag())->setName('facture')->setOwner($owner));

        try {
            $this->processor($owner, [])->process(
                $this->input('facture'),
                new Post(),
                context: ['read_data' => $file],
            );
            self::fail('A duplicate tag must be refused.');
        } catch (ValidationException $exception) {
            self::assertSame('tag', $exception->getConstraintViolationList()->get(0)->getPropertyPath());
        }

        self::assertSame(['facture'], $file->getTagNames(), 'A refused request must not touch the file.');
    }

    public function testItDelegatesPersistenceToTheNativeDoctrineProcessor(): void
    {
        $owner = new User();
        $file = (new File())->setOwner($owner);

        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects(self::once())->method('process')->with($file)->willReturn($file);

        $processor = new FileTagAddProcessor($persistProcessor, $this->tagResolver($owner, []));

        $processor->process($this->input('facture'), new Post(), context: ['read_data' => $file]);
    }

    /**
     * The operation's security expression answers 403 on an anonymous upload
     * long before this guard, whose only job is to make sure a tag is never
     * attached to a file no account owns.
     */
    public function testItRejectsAFileWithoutAnOwner(): void
    {
        $processor = $this->processor(new User(), []);

        $this->expectException(\LogicException::class);

        $processor->process($this->input('facture'), new Post(), context: ['read_data' => new File()]);
    }

    public function testItRejectsAMissingReadFile(): void
    {
        $processor = $this->processor(new User(), []);

        $this->expectException(\LogicException::class);

        $processor->process($this->input('facture'), new Post());
    }

    /**
     * @param list<Tag> $existingTags
     */
    private function processor(User $owner, array $existingTags): FileTagAddProcessor
    {
        return new FileTagAddProcessor(
            $this->passthroughPersistProcessor(),
            $this->tagResolver($owner, $existingTags),
        );
    }

    private function input(string $tag): TagInput
    {
        $input = new TagInput();
        $input->tag = $tag;

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
     * built over a stubbed repository.
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
}
