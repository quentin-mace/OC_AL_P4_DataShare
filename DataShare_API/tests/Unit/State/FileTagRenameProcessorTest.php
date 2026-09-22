<?php

namespace App\Tests\Unit\State;

use ApiPlatform\Metadata\Put;
use ApiPlatform\State\ProcessorInterface;
use ApiPlatform\Validator\Exception\ValidationException;
use App\ApiResource\TagInput;
use App\Entity\File;
use App\Entity\Tag;
use App\Entity\User;
use App\Repository\TagRepository;
use App\State\FileTagRenameProcessor;
use App\State\TagResolver;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[CoversClass(FileTagRenameProcessor::class)]
final class FileTagRenameProcessorTest extends TestCase
{
    /**
     * The product decision of US08: the URI names one file, so the other files
     * of the account keep the old tag.
     */
    public function testItReplacesTheTagOnThisFileOnly(): void
    {
        $owner = new User();
        $shared = (new Tag())->setName('facture')->setOwner($owner);
        $renamed = (new File())->setOwner($owner);
        $untouched = (new File())->setOwner($owner);
        $renamed->addTag($shared);
        $untouched->addTag($shared);

        $this->processor($owner, [])->process(
            $this->input('devis'),
            new Put(),
            ['id' => '1', 'tag' => 'facture'],
            ['read_data' => $renamed],
        );

        self::assertSame(['devis'], $renamed->getTagNames());
        self::assertSame(['facture'], $untouched->getTagNames());
        self::assertSame('facture', $shared->getName(), 'The shared tag is detached, never renamed in place.');
    }

    public function testItDropsTheOldTagFromItsOwnerWhenNoFileCarriesIt(): void
    {
        $owner = new User();
        $orphaned = (new Tag())->setName('facture')->setOwner($owner);
        $owner->addTag($orphaned);
        $file = (new File())->setOwner($owner);
        $file->addTag($orphaned);

        $this->processor($owner, [])->process(
            $this->input('devis'),
            new Put(),
            ['id' => '1', 'tag' => 'facture'],
            ['read_data' => $file],
        );

        self::assertFalse($owner->getTags()->contains($orphaned), 'orphanRemoval deletes it on flush.');
    }

    public function testItKeepsTheOldTagOnItsOwnerWhenAnotherFileCarriesIt(): void
    {
        $owner = new User();
        $shared = (new Tag())->setName('facture')->setOwner($owner);
        $owner->addTag($shared);
        $renamed = (new File())->setOwner($owner);
        $renamed->addTag($shared);
        (new File())->setOwner($owner)->addTag($shared);

        $this->processor($owner, [])->process(
            $this->input('devis'),
            new Put(),
            ['id' => '1', 'tag' => 'facture'],
            ['read_data' => $renamed],
        );

        self::assertTrue($owner->getTags()->contains($shared));
    }

    public function testItReusesAnExistingTagOfTheOwnerAsTheNewName(): void
    {
        $owner = new User();
        $existing = (new Tag())->setName('devis')->setOwner($owner);
        $file = (new File())->setOwner($owner);
        $file->addTag((new Tag())->setName('facture')->setOwner($owner));

        $this->processor($owner, [$existing])->process(
            $this->input('devis'),
            new Put(),
            ['id' => '1', 'tag' => 'facture'],
            ['read_data' => $file],
        );

        self::assertSame($existing, $file->getTags()->first());
    }

    /**
     * Renaming a tag to the name it already has changes nothing, which is not
     * an error: the client's intent is already satisfied.
     */
    public function testItAcceptsARenameToTheSameName(): void
    {
        $owner = new User();
        $tag = (new Tag())->setName('facture')->setOwner($owner);
        $owner->addTag($tag);
        $file = (new File())->setOwner($owner);
        $file->addTag($tag);

        $this->processor($owner, [])->process(
            $this->input('facture'),
            new Put(),
            ['id' => '1', 'tag' => 'facture'],
            ['read_data' => $file],
        );

        self::assertSame([$tag], $file->getTags()->toArray());
        self::assertTrue($owner->getTags()->contains($tag));
    }

    public function testItRejectsARenameToATagAlreadyOnTheFile(): void
    {
        $owner = new User();
        $file = (new File())->setOwner($owner);
        $file->addTag((new Tag())->setName('facture')->setOwner($owner));
        $file->addTag((new Tag())->setName('devis')->setOwner($owner));

        try {
            $this->processor($owner, [])->process(
                $this->input('devis'),
                new Put(),
                ['id' => '1', 'tag' => 'facture'],
                ['read_data' => $file],
            );
            self::fail('A duplicate tag must be refused.');
        } catch (ValidationException $exception) {
            self::assertSame('tag', $exception->getConstraintViolationList()->get(0)->getPropertyPath());
        }

        self::assertEqualsCanonicalizing(['facture', 'devis'], $file->getTagNames());
    }

    public function testItAnswersNotFoundWhenTheFileDoesNotCarryTheTag(): void
    {
        $owner = new User();
        $file = (new File())->setOwner($owner);
        $file->addTag((new Tag())->setName('facture')->setOwner($owner));
        $processor = $this->processor($owner, []);

        $this->expectException(NotFoundHttpException::class);

        $processor->process(
            $this->input('devis'),
            new Put(),
            ['id' => '1', 'tag' => 'inconnu'],
            ['read_data' => $file],
        );
    }

    public function testItRejectsAMissingTagUriVariable(): void
    {
        $owner = new User();
        $processor = $this->processor($owner, []);

        $this->expectException(\LogicException::class);

        $processor->process(
            $this->input('devis'),
            new Put(),
            ['id' => '1'],
            ['read_data' => (new File())->setOwner($owner)],
        );
    }

    public function testItDelegatesPersistenceToTheNativeDoctrineProcessor(): void
    {
        $owner = new User();
        $file = (new File())->setOwner($owner);
        $file->addTag((new Tag())->setName('facture')->setOwner($owner));

        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects(self::once())->method('process')->with($file)->willReturn($file);

        $processor = new FileTagRenameProcessor($persistProcessor, $this->tagResolver($owner, []));

        $processor->process(
            $this->input('devis'),
            new Put(),
            ['id' => '1', 'tag' => 'facture'],
            ['read_data' => $file],
        );
    }

    /**
     * @param list<Tag> $existingTags
     */
    private function processor(User $owner, array $existingTags): FileTagRenameProcessor
    {
        return new FileTagRenameProcessor(
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
