<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\QueryParameter;
use ApiPlatform\OpenApi\Model\Operation as OpenApiOperation;
use App\ApiResource\DownloadPasswordInput;
use App\ApiResource\FileUploadInput;
use App\ApiResource\PresignedDownloadUrl;
use App\Enum\FileType;
use App\Repository\FileRepository;
use App\State\DownloadMetadataProvider;
use App\State\DownloadProcessor;
use App\State\FileDeleteProcessor;
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
            openapi: new OpenApiOperation(security: [['JWT' => []], new \ArrayObject()]),
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
            parameters: ['tag' => new QueryParameter()],
            openapi: new OpenApiOperation(security: [['JWT' => []]]),
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
            openapi: new OpenApiOperation(security: [['JWT' => []]]),
        ),
        new Get(
            uriTemplate: '/downloads/{downloadToken}',
            uriVariables: 'downloadToken',
            provider: DownloadMetadataProvider::class,
            normalizationContext: ['groups' => ['download:read']],
        ),
        new Post(
            uriTemplate: '/downloads/{downloadToken}',
            uriVariables: 'downloadToken',
            status: 200,
            input: DownloadPasswordInput::class,
            output: PresignedDownloadUrl::class,
            processor: DownloadProcessor::class,
            // Overrides the class-level file:read groups, which would
            // otherwise filter out presignedUrl/expiresIn: PresignedDownloadUrl
            // is a plain DTO with no groups of its own.
            normalizationContext: [],
        ),
    ],
    normalizationContext: ['groups' => ['file:read']],
)]
class File
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['file:read', 'file:list'])]
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
    #[Groups(['file:read', 'file:list'])]
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
}
