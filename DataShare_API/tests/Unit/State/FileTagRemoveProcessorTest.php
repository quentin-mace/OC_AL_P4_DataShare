<?php

namespace App\Tests\Unit\State;

use ApiPlatform\Metadata\Delete;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\File;
use App\Entity\Tag;
use App\Entity\User;
use App\State\FileTagRemoveProcessor;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[CoversClass(FileTagRemoveProcessor::class)]
final class FileTagRemoveProcessorTest extends TestCase
{
    public function testItDetachesTheTagFromTheFile(): void
    {
        $owner = new User();
        $file = (new File())->setOwner($owner);
        $file->addTag((new Tag())->setName('facture')->setOwner($owner));
        $file->addTag((new Tag())->setName('devis')->setOwner($owner));

        $processed = $this->processor()->process(
            $file,
            new Delete(),
            ['id' => '1', 'tag' => 'facture'],
            ['read_data' => $file],
        );

        self::assertSame($file, $processed);
        self::assertSame(['devis'], $file->getTagNames());
    }

    public function testItDropsTheTagFromItsOwnerWhenNoFileCarriesIt(): void
    {
        $owner = new User();
        $orphaned = (new Tag())->setName('facture')->setOwner($owner);
        $owner->addTag($orphaned);
        $file = (new File())->setOwner($owner);
        $file->addTag($orphaned);

        $this->processor()->process(
            $file,
            new Delete(),
            ['id' => '1', 'tag' => 'facture'],
            ['read_data' => $file],
        );

        self::assertFalse($owner->getTags()->contains($orphaned), 'orphanRemoval deletes it on flush.');
    }

    public function testItKeepsTheTagWhenAnotherFileCarriesIt(): void
    {
        $owner = new User();
        $shared = (new Tag())->setName('facture')->setOwner($owner);
        $owner->addTag($shared);
        $cleared = (new File())->setOwner($owner);
        $cleared->addTag($shared);
        (new File())->setOwner($owner)->addTag($shared);

        $this->processor()->process(
            $cleared,
            new Delete(),
            ['id' => '1', 'tag' => 'facture'],
            ['read_data' => $cleared],
        );

        self::assertSame([], $cleared->getTagNames());
        self::assertTrue($owner->getTags()->contains($shared));
    }

    public function testItAnswersNotFoundWhenTheFileDoesNotCarryTheTag(): void
    {
        $file = (new File())->setOwner(new User());
        $processor = $this->processor();

        $this->expectException(NotFoundHttpException::class);

        $processor->process($file, new Delete(), ['id' => '1', 'tag' => 'inconnu'], ['read_data' => $file]);
    }

    public function testItRejectsAMissingTagUriVariable(): void
    {
        $file = (new File())->setOwner(new User());
        $processor = $this->processor();

        $this->expectException(\LogicException::class);

        $processor->process($file, new Delete(), ['id' => '1'], ['read_data' => $file]);
    }

    /**
     * The file survives, only its association does not: the persist processor
     * is the right one, and its flush-then-refresh is what makes the response
     * list the remaining tags.
     */
    public function testItDelegatesPersistenceToTheNativeDoctrineProcessor(): void
    {
        $owner = new User();
        $file = (new File())->setOwner($owner);
        $file->addTag((new Tag())->setName('facture')->setOwner($owner));

        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects(self::once())->method('process')->with($file)->willReturn($file);

        (new FileTagRemoveProcessor($persistProcessor))->process(
            $file,
            new Delete(),
            ['id' => '1', 'tag' => 'facture'],
            ['read_data' => $file],
        );
    }

    private function processor(): FileTagRemoveProcessor
    {
        $persistProcessor = $this->createStub(ProcessorInterface::class);
        $persistProcessor->method('process')->willReturnArgument(0);

        return new FileTagRemoveProcessor($persistProcessor);
    }
}
