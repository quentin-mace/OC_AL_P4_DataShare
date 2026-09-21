<?php

namespace App\Tests\Functional;

use App\Entity\File;
use App\Entity\User;
use App\Repository\FileRepository;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class FileDeleteTest extends WebTestCase
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
     * this test wrote to the real MinIO started alongside the app. Objects the
     * tested route already deleted are skipped.
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

        $this->client->request('DELETE', '/api/files/'.$file['id'], server: ['HTTP_ACCEPT' => 'application/json']);

        self::assertResponseStatusCodeSame(401);
        self::assertNotNull($this->findFile((int) $file['id']), 'The row must survive a rejected request.');
    }

    public function testItRejectsAnExpiredToken(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf');

        $this->delete((int) $file['id'], $this->expiredToken($this->owner));

        self::assertResponseStatusCodeSame(401);
        self::assertNotNull($this->findFile((int) $file['id']));
    }

    public function testItDeletesTheFileAndItsStoredObject(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture']]);
        $storageKey = $this->storageKey((int) $file['id']);

        $this->delete((int) $file['id'], $this->token($this->owner));

        self::assertResponseStatusCodeSame(204);
        self::assertEmpty($this->client->getResponse()->getContent());
        self::assertNull($this->findFile((int) $file['id']), 'The metadata must be gone from the database.');
        self::assertFalse($this->storage()->fileExists($storageKey), 'The object must be gone from MinIO.');
    }

    /**
     * US07 states an anonymous upload gives no way to manage the file. No
     * rule is needed for that: the item provider does find the row, and the
     * operation's expression compares its null owner to the authenticated
     * user, which can never match.
     */
    public function testItRefusesToDeleteAnAnonymousUpload(): void
    {
        $file = $this->uploadFile(null, 'anonyme.pdf');
        $storageKey = $this->storageKey((int) $file['id']);

        $this->delete((int) $file['id'], $this->token($this->owner));

        self::assertResponseStatusCodeSame(403);
        self::assertNotNull($this->findFile((int) $file['id']));
        self::assertTrue($this->storage()->fileExists($storageKey), 'A refused deletion must not touch the object.');
    }

    public function testItRefusesToDeleteTheFileOfAnotherUser(): void
    {
        $file = $this->uploadFile($this->owner, 'a-moi.pdf');
        $storageKey = $this->storageKey((int) $file['id']);

        $this->delete((int) $file['id'], $this->token($this->other));

        self::assertResponseStatusCodeSame(403);
        self::assertNotNull($this->findFile((int) $file['id']));
        self::assertTrue($this->storage()->fileExists($storageKey), 'A refused deletion must not touch the object.');
    }

    public function testItAnswersNotFoundForAnUnknownFile(): void
    {
        $this->delete(123456789, $this->token($this->owner));

        self::assertResponseStatusCodeSame(404);
    }

    public function testItAnswersNotFoundOnASecondDeletion(): void
    {
        $file = $this->uploadFile($this->owner, 'rapport.pdf');

        $this->delete((int) $file['id'], $this->token($this->owner));
        $this->delete((int) $file['id'], $this->token($this->owner));

        self::assertResponseStatusCodeSame(404);
    }

    /**
     * An expired file keeps its history row while the automatic purge (US10)
     * removes its object: deleting it must still clear the row.
     */
    public function testItDeletesAFileWhoseObjectIsAlreadyGone(): void
    {
        $file = $this->uploadFile($this->owner, 'perime.pdf');
        $this->storage()->delete($this->storageKey((int) $file['id']));

        $this->delete((int) $file['id'], $this->token($this->owner));

        self::assertResponseStatusCodeSame(204);
        self::assertNull($this->findFile((int) $file['id']));
    }

    private function delete(int $id, string $token): void
    {
        $this->client->request(
            'DELETE',
            '/api/files/'.$id,
            server: [
                'HTTP_AUTHORIZATION' => 'Bearer '.$token,
                'HTTP_ACCEPT' => 'application/json',
            ],
        );
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
        $this->writtenStorageKeys[] = $this->storageKey((int) $body['id']);

        return $body;
    }

    private function storageKey(int $id): string
    {
        $file = $this->findFile($id);
        self::assertInstanceOf(File::class, $file);

        return (string) $file->getStorageKey();
    }

    private function findFile(int $id): ?File
    {
        // The route deletes through its own entity manager, so a previously
        // loaded instance would still sit in the identity map.
        $this->entityManager()->clear();

        return static::getContainer()->get(FileRepository::class)->find($id);
    }

    private function smallFilePath(): string
    {
        static $path = null;
        if (null === $path) {
            $path = tempnam(sys_get_temp_dir(), 'file-delete-test-');
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
}
