<?php

namespace App\Tests\Unit\Entity;

use App\Entity\File;
use App\Entity\Tag;
use App\Entity\User;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(File::class)]
final class FileTest extends TestCase
{
    public function testItFindsATagByName(): void
    {
        $file = new File();
        $tag = (new Tag())->setName('facture')->setOwner(new User());
        $file->addTag($tag);

        self::assertSame($tag, $file->findTag('facture'));
    }

    public function testItReturnsNullWhenItDoesNotCarryTheTag(): void
    {
        $file = new File();
        $file->addTag((new Tag())->setName('facture')->setOwner(new User()));

        self::assertNull($file->findTag('devis'));
    }

    /**
     * Case matters: "Facture" and "facture" are two tags, here as in the
     * UNIQ_TAG_OWNER_NAME index.
     */
    public function testItMatchesTheTagNameCaseSensitively(): void
    {
        $file = new File();
        $file->addTag((new Tag())->setName('facture')->setOwner(new User()));

        self::assertNull($file->findTag('Facture'));
    }

    public function testItDetachesTheTagAndDropsItFromItsOwnerWhenItCarriesNoFile(): void
    {
        $owner = new User();
        $tag = (new Tag())->setName('facture')->setOwner($owner);
        $owner->addTag($tag);
        $file = new File();
        $file->addTag($tag);

        $file->detachTag($tag);

        self::assertSame([], $file->getTagNames());
        self::assertTrue($tag->getFiles()->isEmpty());
        self::assertFalse($owner->getTags()->contains($tag), 'orphanRemoval deletes it on flush.');
    }

    public function testItKeepsTheTagOnItsOwnerWhenAnotherFileCarriesIt(): void
    {
        $owner = new User();
        $tag = (new Tag())->setName('facture')->setOwner($owner);
        $owner->addTag($tag);
        $cleared = new File();
        $kept = new File();
        $cleared->addTag($tag);
        $kept->addTag($tag);

        $cleared->detachTag($tag);

        self::assertSame([], $cleared->getTagNames());
        self::assertSame(['facture'], $kept->getTagNames());
        self::assertTrue($owner->getTags()->contains($tag));
    }
}
