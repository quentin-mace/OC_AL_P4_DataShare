<?php

namespace App\Tests\Unit\State;

use App\Entity\Tag;
use App\Entity\User;
use App\Repository\TagRepository;
use App\State\TagResolver;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(TagResolver::class)]
final class TagResolverTest extends TestCase
{
    public function testItReturnsTheExistingTagOfTheOwner(): void
    {
        $owner = new User();
        $existing = (new Tag())->setName('facture')->setOwner($owner);

        $tag = $this->resolver($owner, [$existing])->resolve($owner, 'facture');

        self::assertSame($existing, $tag);
    }

    public function testItCreatesATagWhenTheOwnerHasNoneOfThatName(): void
    {
        $owner = new User();

        $tag = $this->resolver($owner, [])->resolve($owner, 'facture');

        self::assertSame('facture', $tag->getName());
        self::assertSame($owner, $tag->getOwner());
    }

    /**
     * Two accounts may share a tag name without sharing the row: the lookup
     * is on the pair, and the UNIQ_TAG_OWNER_NAME index says the same.
     */
    public function testItDoesNotReturnTheTagOfAnotherOwner(): void
    {
        $owner = new User();
        $stranger = (new Tag())->setName('facture')->setOwner(new User());

        $tag = $this->resolver($owner, [$stranger])->resolve($owner, 'facture');

        self::assertNotSame($stranger, $tag);
        self::assertSame($owner, $tag->getOwner());
    }

    /**
     * @param list<Tag> $existingTags
     */
    private function resolver(User $owner, array $existingTags): TagResolver
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
