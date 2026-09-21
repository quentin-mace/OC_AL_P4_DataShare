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

final class FileListTest extends WebTestCase
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
        $this->client->request('GET', '/api/files', server: ['HTTP_ACCEPT' => 'application/json']);

        self::assertResponseStatusCodeSame(401);
    }

    public function testItReturnsTheHistoryOfTheAuthenticatedOwner(): void
    {
        $this->uploadFile($this->owner, 'rapport.pdf', ['tags' => ['facture']]);

        $this->list($this->owner);

        self::assertResponseStatusCodeSame(200);

        $body = $this->decodeResponse();
        self::assertCount(1, $body);
        self::assertEqualsCanonicalizing(
            ['id', 'name', 'size', 'sentAt', 'expiresAt', 'status', 'hasPassword', 'downloadToken', 'tags'],
            array_keys($body[0]),
        );
        self::assertSame('rapport.pdf', $body[0]['name']);
        self::assertSame('active', $body[0]['status']);
        self::assertFalse($body[0]['hasPassword']);
        self::assertSame(['facture'], $body[0]['tags']);
    }

    public function testItReturnsAnEmptyArrayForAnOwnerWithoutFiles(): void
    {
        $this->list($this->owner);

        self::assertResponseStatusCodeSame(200);
        self::assertSame([], $this->decodeResponse());
    }

    public function testItDoesNotReturnTheFilesOfAnotherUser(): void
    {
        $this->uploadFile($this->owner, 'a-moi.pdf');
        $this->uploadFile($this->other, 'a-bob.pdf');

        $this->list($this->owner);

        $body = $this->decodeResponse();
        self::assertCount(1, $body);
        self::assertSame('a-moi.pdf', $body[0]['name']);
    }

    public function testItSortsTheMostRecentFirst(): void
    {
        $first = $this->uploadFile($this->owner, 'ancien.pdf');
        $this->uploadFile($this->owner, 'recent.pdf');
        // The two uploads land within the same second, so the older one is
        // pushed back explicitly rather than by waiting.
        $this->shiftUploadDate((int) $first['id'], '-1 hour');

        $this->list($this->owner);

        self::assertSame(['recent.pdf', 'ancien.pdf'], array_column($this->decodeResponse(), 'name'));
    }

    public function testItMarksAnExpiredFileAsExpired(): void
    {
        $this->uploadAndExpireFile($this->owner, 'perime.pdf');

        $this->list($this->owner);

        $body = $this->decodeResponse();
        self::assertCount(1, $body, 'An expired file stays in the history, the dashboard lists it.');
        self::assertSame('expired', $body[0]['status']);
    }

    public function testItReportsAPasswordProtectedFile(): void
    {
        $this->uploadFile($this->owner, 'confidentiel.pdf', ['password' => 'un-mot-de-passe']);

        $this->list($this->owner);

        self::assertTrue($this->decodeResponse()[0]['hasPassword']);
    }

    public function testItFiltersByTag(): void
    {
        $this->uploadFile($this->owner, 'facture.pdf', ['tags' => ['facture', 'client-x']]);
        $this->uploadFile($this->owner, 'photo.jpg', ['tags' => ['perso']]);

        $this->list($this->owner, 'facture');

        $body = $this->decodeResponse();
        self::assertCount(1, $body);
        self::assertSame('facture.pdf', $body[0]['name']);
        self::assertEqualsCanonicalizing(['facture', 'client-x'], $body[0]['tags'], 'Filtering must not strip the other tags.');
    }

    public function testItReturnsAnEmptyArrayForAnUnknownTag(): void
    {
        $this->uploadFile($this->owner, 'facture.pdf', ['tags' => ['facture']]);

        $this->list($this->owner, 'ce-tag-n-existe-pas');

        self::assertResponseStatusCodeSame(200);
        self::assertSame([], $this->decodeResponse());
    }

    public function testItDoesNotMatchTheTagOfAnotherUser(): void
    {
        $this->uploadFile($this->owner, 'a-moi.pdf', ['tags' => ['facture']]);
        $this->uploadFile($this->other, 'a-bob.pdf', ['tags' => ['facture']]);

        $this->list($this->other, 'facture');

        $body = $this->decodeResponse();
        self::assertCount(1, $body);
        self::assertSame('a-bob.pdf', $body[0]['name']);
    }

    private function list(User $user, ?string $tag = null): void
    {
        $this->client->request(
            'GET',
            '/api/files',
            parameters: null === $tag ? [] : ['tag' => $tag],
            server: [
                'HTTP_AUTHORIZATION' => 'Bearer '.$this->token($user),
                'HTTP_ACCEPT' => 'application/json',
            ],
        );
    }

    /**
     * @param array<string, mixed> $fields
     *
     * @return array<string, mixed>
     */
    private function uploadFile(User $owner, string $name, array $fields = []): array
    {
        $this->client->request(
            'POST',
            '/api/files',
            parameters: $fields,
            files: ['file' => new UploadedFile($this->smallFilePath(), $name, 'application/pdf', test: true)],
            server: [
                'HTTP_AUTHORIZATION' => 'Bearer '.$this->token($owner),
                'HTTP_ACCEPT' => 'application/json',
                'CONTENT_TYPE' => 'multipart/form-data',
            ],
        );

        $body = $this->decodeResponse();
        $this->writtenStorageKeys[] = (string) $this->file((int) $body['id'])->getStorageKey();

        return $body;
    }

    private function uploadAndExpireFile(User $owner, string $name): void
    {
        $body = $this->uploadFile($owner, $name);

        $file = $this->file((int) $body['id']);
        $file->setExpirationDate((new \DateTimeImmutable())->modify('-1 second'));
        $this->entityManager()->flush();
    }

    private function shiftUploadDate(int $id, string $modifier): void
    {
        $this->file($id)->setUploadDate((new \DateTimeImmutable())->modify($modifier));
        $this->entityManager()->flush();
    }

    private function file(int $id): File
    {
        $file = static::getContainer()->get(FileRepository::class)->find($id);
        self::assertInstanceOf(File::class, $file);

        return $file;
    }

    private function smallFilePath(): string
    {
        static $path = null;
        if (null === $path) {
            $path = tempnam(sys_get_temp_dir(), 'file-list-test-');
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
