<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Post;
use ApiPlatform\OpenApi\Model\Operation as OpenApiOperation;
use App\ApiResource\FileUploadInput;
use App\Enum\FileType;
use App\Repository\FileRepository;
use App\State\FileUploadProcessor;
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
            security: "is_granted('IS_AUTHENTICATED_FULLY')",
            input: FileUploadInput::class,
            processor: FileUploadProcessor::class,
            // API Platform does not translate the security expression above
            // into OpenAPI on its own: without this, Swagger UI has no way
            // to know the route needs the JWT scheme, so it never attaches
            // the Authorize'd token to this operation's requests.
            openapi: new OpenApiOperation(security: [['JWT' => []]]),
        ),
    ],
    normalizationContext: ['groups' => ['file:read']],
)]
class File
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['file:read'])]
    private ?int $id = null;

    /**
     * Stored in UTC, with a second precision so that short lifespans stay
     * expressible.
     */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['file:read'])]
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
    private ?\DateTimeImmutable $uploadDate = null;

    #[ORM\Column(length: 255)]
    #[Groups(['file:read'])]
    private ?string $name = null;

    #[ORM\Column(enumType: FileType::class)]
    private ?FileType $type = null;

    /**
     * The MIME type detected at upload time, as opposed to $type which only
     * categorizes it.
     */
    #[ORM\Column(length: 255)]
    #[Groups(['file:read'])]
    private ?string $mimeType = null;

    /**
     * Size in bytes.
     */
    #[ORM\Column(type: Types::BIGINT)]
    #[Groups(['file:read'])]
    private ?int $size = null;

    #[ORM\Column(length: 255)]
    private ?string $storageKey = null;

    /**
     * The unpredictable identifier used in the shared download link.
     */
    #[ORM\Column(length: 255, unique: true)]
    #[Groups(['file:read'])]
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
    #[Groups(['file:read'])]
    #[SerializedName('hasPassword')]
    public function isPasswordProtected(): bool
    {
        return null !== $this->password;
    }

    /**
     * @return list<string>
     */
    #[Groups(['file:read'])]
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
