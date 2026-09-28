<?php

namespace App\Tests\Unit\State;

use ApiPlatform\Metadata\Delete;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\File;
use App\Entity\Tag;
use App\Entity\User;
use App\State\FileDeleteProcessor;
use League\Flysystem\FilesystemOperator;
use League\Flysystem\UnableToDeleteFile;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(FileDeleteProcessor::class)]
final class FileDeleteProcessorTest extends TestCase
{
    public function testItDeletesTheStoredObjectThenTheRow(): void
    {
        $file = (new File())->setStorageKey('abcdef.pdf');
        $calls = [];

        $storage = $this->createMock(FilesystemOperator::class);
        $storage->expects(self::once())
            ->method('delete')
            ->with('abcdef.pdf')
            ->willReturnCallback(static function () use (&$calls): void {
                $calls[] = 'storage';
            });

        $removeProcessor = $this->createMock(ProcessorInterface::class);
        $removeProcessor->expects(self::once())
            ->method('process')
            ->with($file)
            ->willReturnCallback(static function () use (&$calls): void {
                $calls[] = 'remove';
            });

        (new FileDeleteProcessor($removeProcessor, $storage))->process($file, new Delete());

        self::assertSame(['storage', 'remove'], $calls, 'The object goes first, so a failed flush never orphans it.');
    }

    public function testItDropsTheTagsNoFileCarriesAnymore(): void
    {
        $owner = new User();
        $orphaned = (new Tag())->setName('facture')->setOwner($owner);
        $owner->addTag($orphaned);
        $file = (new File())->setStorageKey('abcdef.pdf')->setOwner($owner);
        $file->addTag($orphaned);

        $this->processor()->process($file, new Delete());

        self::assertFalse($owner->getTags()->contains($orphaned), 'orphanRemoval deletes it on flush.');
    }

    public function testItKeepsTheTagsAnotherFileStillCarries(): void
    {
        $owner = new User();
        $shared = (new Tag())->setName('facture')->setOwner($owner);
        $owner->addTag($shared);
        $kept = (new File())->setOwner($owner);
        $kept->addTag($shared);
        $deleted = (new File())->setStorageKey('abcdef.pdf')->setOwner($owner);
        $deleted->addTag($shared);

        $this->processor()->process($deleted, new Delete());

        self::assertTrue($owner->getTags()->contains($shared), 'The other file still needs it.');
        self::assertSame(['facture'], $kept->getTagNames());
    }

    public function testItKeepsTheRowWhenTheObjectCannotBeDeleted(): void
    {
        $storage = $this->createStub(FilesystemOperator::class);
        $storage->method('delete')->willThrowException(UnableToDeleteFile::atLocation('abcdef.pdf'));

        $removeProcessor = $this->createMock(ProcessorInterface::class);
        $removeProcessor->expects(self::never())->method('process');

        $processor = new FileDeleteProcessor($removeProcessor, $storage);

        $this->expectException(UnableToDeleteFile::class);

        $processor->process((new File())->setStorageKey('abcdef.pdf'), new Delete());
    }

    public function testItRejectsAnEntityWithoutAStorageKey(): void
    {
        $removeProcessor = $this->createMock(ProcessorInterface::class);
        $removeProcessor->expects(self::never())->method('process');

        $processor = new FileDeleteProcessor($removeProcessor, $this->createStub(FilesystemOperator::class));

        $this->expectException(\LogicException::class);

        $processor->process(new File(), new Delete());
    }

    private function processor(): FileDeleteProcessor
    {
        return new FileDeleteProcessor(
            $this->createStub(ProcessorInterface::class),
            $this->createStub(FilesystemOperator::class),
        );
    }
}
