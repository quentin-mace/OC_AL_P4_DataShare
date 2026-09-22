<?php

namespace App\State;

use App\Entity\Tag;
use App\Entity\User;
use App\Repository\TagRepository;

/**
 * Turns a tag name into the account's tag, existing or new.
 *
 * A tag belongs to an account and is reused from one file to the next: that
 * is what lets it filter the history. Submitting a name the account already
 * knows must therefore attach the existing tag rather than create a twin,
 * which the UNIQ_TAG_OWNER_NAME index forbids anyway.
 *
 * The returned tag is not persisted when it is new: File::$tags cascades the
 * persist, so attaching it to a file is enough.
 */
final readonly class TagResolver
{
    public function __construct(private TagRepository $tagRepository)
    {
    }

    public function resolve(User $owner, string $name): Tag
    {
        $tag = $this->tagRepository->findOneBy(['owner' => $owner, 'name' => $name]);

        return $tag ?? (new Tag())->setName($name)->setOwner($owner);
    }
}
