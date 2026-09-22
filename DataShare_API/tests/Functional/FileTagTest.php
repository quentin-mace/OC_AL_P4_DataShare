<?php

namespace App\Tests\Functional;

use App\Entity\File;
use App\Entity\User;
use App\Repository\FileRepository;
use App\Repository\TagRepository;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * The three tag routes of US08, covered together: they share a file, an owner
 * and the same response shape.
 */
final class FileTagTest extends WebTestCase
{
    private const string OWNER_EMAIL = 'alice@example.com';
    private const string OTHER_EMAIL = 'bob@example.com';

    private KernelBrowser $client;

    private User $owner;

    private User $other;

    /**
     * @var list<string>
     */
    private array $writtenStorageKeys = [];

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->owner = $this->createUser(self::OWNER_EMAIL);
        $this->other = $this->createUser(self::OTHER_EMAIL);
    }

    /**
     * dama/doctrine-test-bundle rolls the database back, but not the objects
     * this test wrote to the real MinIO started alongside the app.
     */
    protected function tearDown(): void
    {
        $storage = $this->storage();
        foreach ($this->writtenStorageKeys as $storageKey) {
            if ($storage->fileExists($storageKey)) {
                $storage->delete($storageKey);
            }
        }

        parent::tearDown();
    }

    public function testItRequiresAuthentication(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf');

        $this->client->request(
            'POST',
            '/api/files/'.$file['id'].'/tags',
            server: ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json'],
            content: json_encode(['tag' => 'facture'], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(401);
        self::assertSame([], $this->tagsOf((int) $file['id']));
    }

    public function testItRejectsAnExpiredToken(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf');

        $this->addTag((int) $file['id'], 'facture', $this->expiredToken($this->owner));

        self::assertResponseStatusCodeSame(401);
        self::assertSame([], $this->tagsOf((int) $file['id']));
    }

    public function testItReturnsOnlyTheIdAndTheTags(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf');

        $this->addTag((int) $file['id'], 'facture', $this->token($this->owner));

        self::assertResponseStatusCodeSame(201);
        $body = $this->decodeResponse();
        self::assertEqualsCanonicalizing(['id', 'tags'], array_keys($body));
        self::assertSame((int) $file['id'], $body['id']);
        self::assertSame(['facture'], $body['tags']);
    }

    public function testItRefusesToTagTheFileOfAnotherUser(): void
    {
        $file = $this->uploadFile($this->owner, 'a-moi.pdf');

        $this->addTag((int) $file['id'], 'facture', $this->token($this->other));

        self::assertResponseStatusCodeSame(403);
        self::assertSame([], $this->tagsOf((int) $file['id']));
    }

    /**
     * No rule is needed for this: the operation's expression compares the null
     * owner of an anonymous upload to the authenticated user, which can never
     * match. Same reasoning as DELETE /api/files/{id}, see US07.
     */
    public function testItRefusesToTagAnAnonymousUpload(): void
    {
        $file = $this->uploadFile(null, 'anonyme.pdf');

        $this->addTag((int) $file['id'], 'facture', $this->token($this->owner));

        self::assertResponseStatusCodeSame(403);
    }

    /**
     * The guard on FileTagProvider: the default Doctrine provider would let an
     * unknown id through on a POST, and the security expression would then be
     * evaluated on a null object.
     */
    public function testItAnswersNotFoundForAnUnknownFile(): void
    {
        $this->addTag(123456789, 'facture', $this->token($this->owner));

        self::assertResponseStatusCodeSame(404);
    }

    /**
     * A user-supplied uriTemplate gets no {._format} suffix, so {tag} matches
     * anything but a slash. A future refactor reintroducing the suffix would
     * silently cut "v1.0" down to "v1".
     */
    public function testItAcceptsATagNameContainingADot(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf');
        $this->addTag((int) $file['id'], 'v1.0', $this->token($this->owner));

        $this->renameTag((int) $file['id'], 'v1.0', 'v2.0', $this->token($this->owner));

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['v2.0'], $this->decodeResponse()['tags']);
    }

    public function testItAddsATagToTheFile(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture']]);

        $this->addTag((int) $file['id'], 'client-x', $this->token($this->owner));

        self::assertResponseStatusCodeSame(201);
        self::assertEqualsCanonicalizing(['facture', 'client-x'], $this->decodeResponse()['tags']);
        self::assertEqualsCanonicalizing(['facture', 'client-x'], $this->tagsOf((int) $file['id']));
    }

    public function testItReusesTheExistingTagOfTheOwner(): void
    {
        $first = $this->uploadFile($this->owner, 'premier.pdf', ['tags' => ['facture']]);
        $second = $this->uploadFile($this->owner, 'second.pdf');

        $this->addTag((int) $second['id'], 'facture', $this->token($this->owner));

        self::assertResponseStatusCodeSame(201);
        self::assertSame(['facture'], $this->tagsOf((int) $first['id']));
        self::assertSame(1, $this->countTagsOf($this->owner), 'The tag must be shared, not duplicated.');
    }

    public function testItDoesNotReuseTheTagOfAnotherUser(): void
    {
        $mine = $this->uploadFile($this->owner, 'a-moi.pdf');
        $this->uploadFile($this->other, 'a-lui.pdf', ['tags' => ['facture']]);

        $this->addTag((int) $mine['id'], 'facture', $this->token($this->owner));

        self::assertResponseStatusCodeSame(201);
        self::assertSame(1, $this->countTagsOf($this->owner));
        self::assertSame(1, $this->countTagsOf($this->other));
    }

    public function testItRejectsATagAlreadyOnTheFile(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture']]);

        $this->addTag((int) $file['id'], 'facture', $this->token($this->owner));

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['tag'], $this->violatedFields());
        self::assertSame(['facture'], $this->tagsOf((int) $file['id']));
    }

    public function testItRejectsAnEmptyTag(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf');

        $this->addTag((int) $file['id'], '   ', $this->token($this->owner));

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['tag'], $this->violatedFields());
    }

    public function testItRejectsATagLongerThanThirtyCharacters(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf');

        $this->addTag((int) $file['id'], str_repeat('a', 31), $this->token($this->owner));

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['tag'], $this->violatedFields());
    }

    public function testItTrimsTheSubmittedTag(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf');

        $this->addTag((int) $file['id'], '  facture  ', $this->token($this->owner));

        self::assertResponseStatusCodeSame(201);
        self::assertSame(['facture'], $this->decodeResponse()['tags']);
    }

    /**
     * The product decision of US08: the URI names one file, so the rename
     * stops there. The account's other files keep the old name.
     */
    public function testItRenamesTheTagOnThisFileOnly(): void
    {
        $renamed = $this->uploadFile($this->owner, 'premier.pdf', ['tags' => ['facture']]);
        $untouched = $this->uploadFile($this->owner, 'second.pdf', ['tags' => ['facture']]);

        $this->renameTag((int) $renamed['id'], 'facture', 'devis', $this->token($this->owner));

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['devis'], $this->decodeResponse()['tags']);
        self::assertSame(['facture'], $this->tagsOf((int) $untouched['id']));
    }

    public function testItDeletesTheOldTagWhenNoFileCarriesItAnymore(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture']]);

        $this->renameTag((int) $file['id'], 'facture', 'devis', $this->token($this->owner));

        self::assertResponseStatusCodeSame(200);
        self::assertSame(1, $this->countTagsOf($this->owner), 'The orphan tag must be gone.');
    }

    public function testItKeepsTheOldTagWhenAnotherFileStillCarriesIt(): void
    {
        $renamed = $this->uploadFile($this->owner, 'premier.pdf', ['tags' => ['facture']]);
        $this->uploadFile($this->owner, 'second.pdf', ['tags' => ['facture']]);

        $this->renameTag((int) $renamed['id'], 'facture', 'devis', $this->token($this->owner));

        self::assertResponseStatusCodeSame(200);
        self::assertSame(2, $this->countTagsOf($this->owner));
    }

    public function testItReusesAnExistingTagWhenRenaming(): void
    {
        $renamed = $this->uploadFile($this->owner, 'premier.pdf', ['tags' => ['facture']]);
        $this->uploadFile($this->owner, 'second.pdf', ['tags' => ['devis']]);

        $this->renameTag((int) $renamed['id'], 'facture', 'devis', $this->token($this->owner));

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['devis'], $this->decodeResponse()['tags']);
        self::assertSame(1, $this->countTagsOf($this->owner), 'The old tag went, the new one was reused.');
    }

    public function testItRejectsARenameToATagAlreadyOnTheFile(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture', 'devis']]);

        $this->renameTag((int) $file['id'], 'facture', 'devis', $this->token($this->owner));

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['tag'], $this->violatedFields());
        self::assertEqualsCanonicalizing(['facture', 'devis'], $this->tagsOf((int) $file['id']));
    }

    /**
     * Renaming a tag to the name it already has changes nothing, which is not
     * an error: the client's intent is already satisfied.
     */
    public function testItAcceptsARenameToTheSameName(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture']]);

        $this->renameTag((int) $file['id'], 'facture', 'facture', $this->token($this->owner));

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['facture'], $this->decodeResponse()['tags']);
        self::assertSame(1, $this->countTagsOf($this->owner));
    }

    public function testItAnswersNotFoundWhenRenamingATagTheFileDoesNotCarry(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture']]);

        $this->renameTag((int) $file['id'], 'inconnu', 'devis', $this->token($this->owner));

        self::assertResponseStatusCodeSame(404);
        self::assertSame(['facture'], $this->tagsOf((int) $file['id']));
    }

    /**
     * The 404 on a missing tag is raised in the processor and not in the
     * provider, which runs before the security expression: otherwise a
     * stranger could tell an existing tag from a missing one by comparing 403
     * and 404.
     */
    public function testItPrefersForbiddenOverNotFoundForAStranger(): void
    {
        $file = $this->uploadFile($this->owner, 'a-moi.pdf', ['tags' => ['facture']]);

        $this->removeTag((int) $file['id'], 'inconnu', $this->token($this->other));

        self::assertResponseStatusCodeSame(403);
    }

    public function testItRemovesTheTagFromTheFile(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture', 'devis']]);

        $this->removeTag((int) $file['id'], 'facture', $this->token($this->owner));

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['devis'], $this->decodeResponse()['tags']);
        self::assertSame(['devis'], $this->tagsOf((int) $file['id']));
    }

    public function testItDeletesTheTagWhenTheLastFileDropsIt(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture']]);

        $this->removeTag((int) $file['id'], 'facture', $this->token($this->owner));

        self::assertResponseStatusCodeSame(200);
        self::assertSame([], $this->decodeResponse()['tags']);
        self::assertSame(0, $this->countTagsOf($this->owner), 'The orphan tag must be gone.');
    }

    public function testItKeepsTheTagWhenAnotherFileStillCarriesIt(): void
    {
        $cleared = $this->uploadFile($this->owner, 'premier.pdf', ['tags' => ['facture']]);
        $kept = $this->uploadFile($this->owner, 'second.pdf', ['tags' => ['facture']]);

        $this->removeTag((int) $cleared['id'], 'facture', $this->token($this->owner));

        self::assertResponseStatusCodeSame(200);
        self::assertSame(1, $this->countTagsOf($this->owner));
        self::assertSame(['facture'], $this->tagsOf((int) $kept['id']));
    }

    public function testItAnswersNotFoundWhenRemovingATagTheFileDoesNotCarry(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture']]);

        $this->removeTag((int) $file['id'], 'inconnu', $this->token($this->owner));

        self::assertResponseStatusCodeSame(404);
        self::assertSame(['facture'], $this->tagsOf((int) $file['id']));
    }

    /**
     * The tags posted after the upload must reach the history filter, which is
     * the point of US08.
     */
    public function testTheHistoryFilterSeesATagAddedAfterTheUpload(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf');
        $this->addTag((int) $file['id'], 'facture', $this->token($this->owner));

        $this->client->request(
            'GET',
            '/api/files?tag=facture',
            server: [
                'HTTP_AUTHORIZATION' => 'Bearer '.$this->token($this->owner),
                'HTTP_ACCEPT' => 'application/json',
            ],
        );

        self::assertResponseIsSuccessful();
        $body = $this->decodeResponse();
        self::assertCount(1, $body);
        self::assertSame((int) $file['id'], $body[0]['id']);
    }

    private function addTag(int $id, string $tag, string $token): void
    {
        $this->client->request(
            'POST',
            '/api/files/'.$id.'/tags',
            server: $this->jsonServer($token),
            content: json_encode(['tag' => $tag], JSON_THROW_ON_ERROR),
        );
    }

    private function renameTag(int $id, string $currentName, string $newName, string $token): void
    {
        $this->client->request(
            'PUT',
            '/api/files/'.$id.'/tags/'.rawurlencode($currentName),
            server: $this->jsonServer($token),
            content: json_encode(['tag' => $newName], JSON_THROW_ON_ERROR),
        );
    }

    private function removeTag(int $id, string $tag, string $token): void
    {
        $this->client->request(
            'DELETE',
            '/api/files/'.$id.'/tags/'.rawurlencode($tag),
            server: [
                'HTTP_AUTHORIZATION' => 'Bearer '.$token,
                'HTTP_ACCEPT' => 'application/json',
            ],
        );
    }

    /**
     * @return array<string, string>
     */
    private function jsonServer(string $token): array
    {
        return [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ];
    }

    /**
     * @return list<string>
     */
    private function tagsOf(int $id): array
    {
        $file = $this->findFile($id);
        self::assertInstanceOf(File::class, $file);

        return $file->getTagNames();
    }

    private function countTagsOf(User $user): int
    {
        $this->entityManager()->clear();

        return static::getContainer()->get(TagRepository::class)->count(['owner' => $user->getId()]);
    }

    /**
     * @param array<string, mixed> $fields
     *
     * @return array<string, mixed>
     */
    private function uploadFile(?User $owner, string $name, array $fields = []): array
    {
        $server = [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'multipart/form-data',
        ];
        // A null owner is the anonymous upload of US07.
        if (null !== $owner) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer '.$this->token($owner);
        }

        $this->client->request(
            'POST',
            '/api/files',
            parameters: $fields,
            files: ['file' => new UploadedFile($this->smallFilePath(), $name, 'application/pdf', test: true)],
            server: $server,
        );

        $body = $this->decodeResponse();
        $file = $this->findFile((int) $body['id']);
        self::assertInstanceOf(File::class, $file);
        $this->writtenStorageKeys[] = (string) $file->getStorageKey();

        return $body;
    }

    private function findFile(int $id): ?File
    {
        // The routes write through their own entity manager, so a previously
        // loaded instance would still sit in the identity map.
        $this->entityManager()->clear();

        return static::getContainer()->get(FileRepository::class)->find($id);
    }

    private function smallFilePath(): string
    {
        static $path = null;
        if (null === $path) {
            $path = tempnam(sys_get_temp_dir(), 'file-tag-test-');
            file_put_contents($path, 'contenu du fichier');
        }

        return $path;
    }

    private function createUser(string $email): User
    {
        $user = new User();
        $user->setEmail($email);
        $user->setFirstName('Prenom');
        $user->setLastName('Nom');
        $user->setPassword(
            static::getContainer()->get(UserPasswordHasherInterface::class)
                ->hashPassword($user, 'correct-cheval-batterie'),
        );

        $entityManager = $this->entityManager();
        $entityManager->persist($user);
        $entityManager->flush();

        return $user;
    }

    private function token(User $user): string
    {
        return static::getContainer()->get(JWTTokenManagerInterface::class)->create($user);
    }

    private function expiredToken(User $user): string
    {
        return static::getContainer()->get(JWTTokenManagerInterface::class)
            ->createFromPayload($user, ['exp' => time() - 60]);
    }

    private function entityManager(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }

    private function storage(): FilesystemOperator
    {
        return static::getContainer()->get('default.storage');
    }

    /**
     * @return array<int|string, mixed>
     */
    private function decodeResponse(): array
    {
        return json_decode(
            (string) $this->client->getResponse()->getContent(),
            true,
            flags: JSON_THROW_ON_ERROR,
        );
    }

    /**
     * @return list<string>
     */
    private function violatedFields(): array
    {
        return array_column($this->decodeResponse()['violations'], 'propertyPath');
    }
}
