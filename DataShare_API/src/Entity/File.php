<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Link;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use ApiPlatform\Metadata\QueryParameter;
use ApiPlatform\OpenApi\Model\Operation as OpenApiOperation;
use ApiPlatform\OpenApi\Model\Response as OpenApiResponse;
use App\ApiResource\DownloadPasswordInput;
use App\ApiResource\FileUploadInput;
use App\ApiResource\PresignedDownloadUrl;
use App\ApiResource\TagInput;
use App\Enum\FileType;
use App\Repository\FileRepository;
use App\State\DownloadMetadataProvider;
use App\State\DownloadProcessor;
use App\State\FileDeleteProcessor;
use App\State\FileTagAddProcessor;
use App\State\FileTagProvider;
use App\State\FileTagRemoveProcessor;
use App\State\FileTagRenameProcessor;
use App\State\FileUploadProcessor;
use App\State\UserFilesProvider;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Attribute\SerializedName;

#[ORM\Entity(repositoryClass: FileRepository::class)]
#[ApiResource(
    operations: [
        new Post(
            inputFormats: ['multipart' => ['multipart/form-data']],
            input: FileUploadInput::class,
            processor: FileUploadProcessor::class,
            // No security expression: authentication is optional here, an
            // anonymous upload landing with a null owner (US07). Optional is
            // not ignored though, a malformed or expired Bearer header still
            // answers 401: JWTAuthenticator::supports() returns a strict true,
            // which switches the lazy firewall to eager authentication well
            // before this operation runs. The two 401 tests in
            // FileUploadTest are the only guards left on that behaviour.
            //
            // The security below is documentation only. API Platform builds
            // no root security requirement here (none of api_keys/http_auth/
            // oauth is configured) and the Lexik factory only registers the
            // JWT *scheme*, so without this Swagger UI would never attach the
            // Authorize'd token. The empty ArrayObject is the OpenAPI way of
            // spelling "or no auth at all"; a bare [] would serialize as a
            // JSON array where an object is required.
            openapi: new OpenApiOperation(
                // "Creates a File resource." says nothing of the two parcours
                // this single route serves, which is its whole point.
                summary: 'Uploads a file, with or without an account.',
                security: [['JWT' => []], new \ArrayObject()],
            ),
        ),
        new GetCollection(
            security: "is_granted('IS_AUTHENTICATED_FULLY')",
            provider: UserFilesProvider::class,
            normalizationContext: ['groups' => ['file:list']],
            // A collection is a plain array, see tech_stack.md: pagination is
            // left to the front-end, which also filters active/expired
            // client-side. Enabled, API Platform would silently cut the
            // history at its 30th item.
            paginationEnabled: false,
            // Declares ?tag= so it shows up in OpenAPI and reaches the
            // provider through $context['filters'].
            parameters: ['tag' => new QueryParameter(description: 'Keeps only the files carrying this exact tag name')],
            openapi: new OpenApiOperation(
                // Not "the collection of File resources": this route never
                // returns anyone else's files, nor the anonymous uploads.
                summary: "Retrieves the authenticated user's upload history.",
                security: [['JWT' => []]],
            ),
        ),
        new Delete(
            // No provider is declared, so API Platform loads the entity with
            // the default Doctrine item provider: an unknown id answers 404
            // without a line of code here. The expression below is evaluated
            // on that loaded object, hence the 403 on someone else's file. It
            // also covers anonymous uploads, whose owner is null and can
            // therefore never equal an authenticated user.
            security: "is_granted('IS_AUTHENTICATED_FULLY') and object.getOwner() === user",
            processor: FileDeleteProcessor::class,
            openapi: new OpenApiOperation(
                // Spells out the stored object, which "Removes the File
                // resource." leaves to guess, and tells this route apart from
                // the tag removal further up.
                summary: 'Deletes the file and its stored object.',
                security: [['JWT' => []]],
            ),
        ),
        // The three tag operations below are nested under the file rather than
        // exposed as a /tags resource: a tag has no life of its own, and the
        // contract answers with the file's tag list. They all go through
        // FileTagProvider, whose docblock explains why the Doctrine one cannot
        // be used here, and all narrow the response to {id, tags} through the
        // file:tags group, which overrides the class-level file:read.
        new Post(
            uriTemplate: '/files/{id}/tags',
            uriVariables: ['id' => new Link(fromClass: File::class, identifiers: ['id'])],
            security: "is_granted('IS_AUTHENTICATED_FULLY') and object.getOwner() === user",
            input: TagInput::class,
            provider: FileTagProvider::class,
            processor: FileTagAddProcessor::class,
            normalizationContext: ['groups' => ['file:tags']],
            // Without a summary, Swagger UI falls back on the one API Platform
            // derives from the method and the resource, "Creates a File
            // resource.", which describes neither what the route does nor what
            // it answers.
            openapi: new OpenApiOperation(
                summary: 'Adds a tag to the file.',
                security: [['JWT' => []]],
            ),
        ),
        new Put(
            uriTemplate: '/files/{id}/tags/{tag}',
            uriVariables: [
                'id' => new Link(fromClass: File::class, identifiers: ['id']),
                // A tag name, not a technical identifier. Declaring the link
                // against Tag::$name only documents the parameter and makes
                // UriVariablesConverter see a string, which has no transformer
                // and therefore leaves the value untouched.
                'tag' => new Link(fromClass: Tag::class, identifiers: ['name'], description: 'The tag name to rename'),
            ],
            security: "is_granted('IS_AUTHENTICATED_FULLY') and object.getOwner() === user",
            input: TagInput::class,
            provider: FileTagProvider::class,
            processor: FileTagRenameProcessor::class,
            normalizationContext: ['groups' => ['file:tags']],
            openapi: new OpenApiOperation(
                // "Replaces the File resource." would be doubly misleading: the
                // file is untouched, and the rename stops at this one file.
                summary: 'Renames a tag on this file only.',
                security: [['JWT' => []]],
            ),
        ),
        new Delete(
            uriTemplate: '/files/{id}/tags/{tag}',
            uriVariables: [
                'id' => new Link(fromClass: File::class, identifiers: ['id']),
                'tag' => new Link(fromClass: Tag::class, identifiers: ['name'], description: 'The tag name to remove'),
            ],
            // This route removes an association, not the file: it answers with
            // the remaining tags, hence the 200 instead of the default 204.
            status: 200,
            security: "is_granted('IS_AUTHENTICATED_FULLY') and object.getOwner() === user",
            provider: FileTagProvider::class,
            processor: FileTagRemoveProcessor::class,
            normalizationContext: ['groups' => ['file:tags']],
            // A DELETE is documented without a response body whatever its
            // status, so the schema has to be spelled out or the front would
            // never see that this route answers with the remaining tags.
            openapi: new OpenApiOperation(
                // "Removes the File resource." would read as if the whole file
                // were being deleted, which is what DELETE /api/files/{id} does.
                summary: 'Removes a tag from the file.',
                security: [['JWT' => []]],
                responses: [
                    '200' => new OpenApiResponse(
                        'The tags the file still carries',
                        new \ArrayObject([
                            'application/json' => ['schema' => ['$ref' => '#/components/schemas/File-file.tags']],
                        ]),
                    ),
                ],
            ),
        ),
        // Both share-link routes spell their URI variable out rather than use
        // the string shorthand, which documents it as "File identifier": a
        // download token is not the file's id, and telling the two apart is
        // exactly what keeps the history private.
        new Get(
            uriTemplate: '/downloads/{downloadToken}',
            uriVariables: ['downloadToken' => new Link(fromClass: File::class, identifiers: ['downloadToken'], description: self::DOWNLOAD_TOKEN_DESCRIPTION)],
            provider: DownloadMetadataProvider::class,
            normalizationContext: ['groups' => ['download:read']],
            openapi: new OpenApiOperation(
                // The route answers a subset of the file, for anyone holding
                // the link: "Retrieves a File resource." oversells it.
                summary: 'Retrieves the metadata behind a share link.',
            ),
        ),
        new Post(
            uriTemplate: '/downloads/{downloadToken}',
            uriVariables: ['downloadToken' => new Link(fromClass: File::class, identifiers: ['downloadToken'], description: self::DOWNLOAD_TOKEN_DESCRIPTION)],
            status: 200,
            input: DownloadPasswordInput::class,
            output: PresignedDownloadUrl::class,
            processor: DownloadProcessor::class,
            // Overrides the class-level file:read groups, which would
            // otherwise filter out presignedUrl/expiresIn: PresignedDownloadUrl
            // is a plain DTO with no groups of its own.
            normalizationContext: [],
            // A POST here creates nothing, so the derived "Creates a File
            // resource." is wrong: it checks the link's password, if any, and
            // hands back a presigned URL.
            openapi: new OpenApiOperation(summary: 'Issues a short-lived presigned download URL.'),
        ),
    ],
    normalizationContext: ['groups' => ['file:read']],
)]
class File
{
    /**
     * Shared by the two share-link operations, which are declared before the
     * class body is otherwise usable, hence a constant rather than a literal
     * repeated twice.
     */
    private const string DOWNLOAD_TOKEN_DESCRIPTION = 'The unpredictable token from the shared download link';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['file:read', 'file:list', 'file:tags'])]
    private ?int $id = null;

    /**
     * Stored in UTC, with a second precision so that short lifespans stay
     * expressible.
     */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['file:read', 'file:list', 'download:read'])]
    #[SerializedName('expiresAt')]
    private ?\DateTimeImmutable $expirationDate = null;

    /**
     * Hashed, never returned: see FileUploadProcessor. Null when the download
     * is not password-protected.
     */
    #[ORM\Column(length: 255, nullable: true)]
    private ?string $password = null;

    /**
     * Stored in UTC.
     */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['file:list'])]
    #[SerializedName('sentAt')]
    private ?\DateTimeImmutable $uploadDate = null;

    #[ORM\Column(length: 255)]
    #[Groups(['file:read', 'file:list', 'download:read'])]
    private ?string $name = null;

    #[ORM\Column(enumType: FileType::class)]
    private ?FileType $type = null;

    /**
     * The MIME type detected at upload time, as opposed to $type which only
     * categorizes it.
     */
    #[ORM\Column(length: 255)]
    #[Groups(['file:read', 'download:read'])]
    private ?string $mimeType = null;

    /**
     * Size in bytes.
     */
    #[ORM\Column(type: Types::BIGINT)]
    #[Groups(['file:read', 'file:list', 'download:read'])]
    private ?int $size = null;

    #[ORM\Column(length: 255)]
    private ?string $storageKey = null;

    /**
     * The unpredictable identifier used in the shared download link.
     */
    #[ORM\Column(length: 255, unique: true)]
    #[Groups(['file:read', 'file:list'])]
    private ?string $downloadToken = null;

    /**
     * Null for an anonymous upload. Owned files are removed with their owner,
     * see User::$files.
     */
    #[ORM\ManyToOne(inversedBy: 'files')]
    #[ORM\JoinColumn(nullable: true)]
    private ?User $owner = null;

    /**
     * A new tag submitted alongside the file is persisted along with it.
     *
     * @var Collection<int, Tag>
     */
    #[ORM\ManyToMany(targetEntity: Tag::class, inversedBy: 'files', cascade: ['persist'])]
    private Collection $tags;

    public function __construct()
    {
        $this->tags = new ArrayCollection();
    }

    /**
     * Whether the download requires a password, without ever exposing its
     * hash.
     *
     * Deliberately not named hasPassword(): the serializer resolves a
     * property from the "has"/"is" prefix (here, "password"), which would
     * then be read through getPassword() instead of this method, leaking the
     * hash under the "hasPassword" key.
     */
    #[Groups(['file:read', 'file:list', 'download:read'])]
    #[SerializedName('hasPassword')]
    public function isPasswordProtected(): bool
    {
        return null !== $this->password;
    }

    /**
     * The state of the share link, derived from the expiration date rather
     * than stored: a column would go stale the second the date passes, with
     * nothing to write it back.
     */
    #[Groups(['file:list'])]
    public function getStatus(): string
    {
        return $this->expirationDate > new \DateTimeImmutable() ? 'active' : 'expired';
    }

    /**
     * @return list<string>
     */
    #[Groups(['file:read', 'file:list', 'file:tags'])]
    #[SerializedName('tags')]
    public function getTagNames(): array
    {
        return array_values(array_map(static fn (Tag $tag): string => (string) $tag->getName(), $this->tags->toArray()));
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getExpirationDate(): ?\DateTimeImmutable
    {
        return $this->expirationDate;
    }

    public function setExpirationDate(\DateTimeImmutable $expirationDate): static
    {
        $this->expirationDate = $expirationDate;

        return $this;
    }

    public function getPassword(): ?string
    {
        return $this->password;
    }

    public function setPassword(?string $password): static
    {
        $this->password = $password;

        return $this;
    }

    public function getUploadDate(): ?\DateTimeImmutable
    {
        return $this->uploadDate;
    }

    public function setUploadDate(\DateTimeImmutable $uploadDate): static
    {
        $this->uploadDate = $uploadDate;

        return $this;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getType(): ?FileType
    {
        return $this->type;
    }

    public function setType(FileType $type): static
    {
        $this->type = $type;

        return $this;
    }

    public function getMimeType(): ?string
    {
        return $this->mimeType;
    }

    public function setMimeType(string $mimeType): static
    {
        $this->mimeType = $mimeType;

        return $this;
    }

    public function getSize(): ?int
    {
        return $this->size;
    }

    public function setSize(int $size): static
    {
        $this->size = $size;

        return $this;
    }

    public function getStorageKey(): ?string
    {
        return $this->storageKey;
    }

    public function setStorageKey(string $storageKey): static
    {
        $this->storageKey = $storageKey;

        return $this;
    }

    public function getDownloadToken(): ?string
    {
        return $this->downloadToken;
    }

    public function setDownloadToken(string $downloadToken): static
    {
        $this->downloadToken = $downloadToken;

        return $this;
    }

    public function getOwner(): ?User
    {
        return $this->owner;
    }

    public function setOwner(?User $owner): static
    {
        $this->owner = $owner;

        return $this;
    }

    /**
     * @return Collection<int, Tag>
     */
    public function getTags(): Collection
    {
        return $this->tags;
    }

    public function addTag(Tag $tag): static
    {
        if (!$this->tags->contains($tag)) {
            $this->tags->add($tag);
            // Keep the inverse side in sync; the contains() guards on both ends
            // stop the recursion.
            $tag->addFile($this);
        }

        return $this;
    }

    public function removeTag(Tag $tag): static
    {
        if ($this->tags->removeElement($tag)) {
            $tag->removeFile($this);
        }

        return $this;
    }

    /**
     * Deliberately prefixed "find" rather than "get" or "has": the serializer
     * only considers argument-less accessors, but there is no reason to walk
     * back towards the trap documented on isPasswordProtected().
     */
    public function findTag(string $name): ?Tag
    {
        foreach ($this->tags as $tag) {
            if ($tag->getName() === $name) {
                return $tag;
            }
        }

        return null;
    }

    /**
     * Drops the tag from this file, and from its owner when no file carries it
     * anymore: User::$tags is an orphanRemoval collection, so the row is gone
     * on flush.
     *
     * The order matters. removeTag() initializes Tag::$files before removing
     * this file from it, so isEmpty() below reads an up-to-date in-memory
     * state. Marking Tag::$files EXTRA_LAZY would break that: isEmpty() would
     * then issue a COUNT still seeing the unflushed file_tag row, and the
     * orphan would never be collected.
     */
    public function detachTag(Tag $tag): static
    {
        $this->removeTag($tag);

        if ($tag->getFiles()->isEmpty()) {
            $tag->getOwner()?->removeTag($tag);
        }

        return $this;
    }
}
