<?php

namespace App\State;

use ApiPlatform\Validator\Exception\ValidationException;
use App\Entity\File;
use App\Entity\User;
use Symfony\Component\Validator\ConstraintViolation;
use Symfony\Component\Validator\ConstraintViolationList;

/**
 * What the three tag processors have in common: getting to the file behind
 * the URI, and refusing a tag the file already carries.
 */
trait FileTagOperationTrait
{
    /**
     * FileTagProvider already answered 404 on an unknown id, and WriteListener
     * hands its result over under "read_data". Unlike $data on a POST or a
     * PUT, which is the TagInput, and unlike "previous_data", which is a
     * clone, this is the entity Doctrine manages.
     *
     * @param array<string, mixed> $context
     */
    private function readFile(array $context): File
    {
        $file = $context['read_data'] ?? null;

        if (!$file instanceof File) {
            throw new \LogicException('The tag operations require the file read from the URI.');
        }

        return $file;
    }

    /**
     * A tag belongs to an account, so a file without one cannot carry any. The
     * operation's security expression compares the owner to the authenticated
     * user, so an anonymous upload answers 403 long before this point; the
     * guard only makes sure the case is never handled silently.
     */
    private function ownerOf(File $file): User
    {
        $owner = $file->getOwner();

        if (null === $owner) {
            throw new \LogicException('An anonymous upload cannot carry tags.');
        }

        return $owner;
    }

    /**
     * Same 422 as the validator, RFC 7807 with a violation on "tag". This rule
     * depends on the tags the file already carries, which TagInput knows
     * nothing about, so it cannot live in a constraint; and a plain
     * HttpException would answer 422 without any violations at all.
     */
    private function rejectDuplicate(string $tagName): never
    {
        $message = sprintf('The "%s" tag is already on this file.', $tagName);

        throw new ValidationException(new ConstraintViolationList([new ConstraintViolation($message, $message, [], null, 'tag', $tagName)]));
    }
}
