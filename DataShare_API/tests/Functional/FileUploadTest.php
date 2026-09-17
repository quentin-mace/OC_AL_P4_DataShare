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

final class FileUploadTest extends WebTestCase
{
    private const string OWNER_EMAIL = 'alice@example.com';
    private const string OWNER_PASSWORD = 'correct-cheval-batterie';

    private KernelBrowser $client;
    private User $owner;

    /**
     * @var list<string>
     */
    private array $writtenStorageKeys = [];

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->owner = $this->createUser(self::OWNER_EMAIL);
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

    public function testItUploadsAFileForTheAuthenticatedOwner(): void
    {
        $this->upload($this->token($this->owner), ['expiresInDays' => '3', 'tags' => ['facture', 'client-x']]);

        self::assertResponseStatusCodeSame(201);

        $body = $this->decodeResponse();
        self::assertEqualsCanonicalizing(
            ['id', 'name', 'size', 'mimeType', 'downloadToken', 'expiresAt', 'hasPassword', 'tags'],
            array_keys($body),
        );
        self::assertSame('rapport.pdf', $body['name']);
        self::assertSame('application/pdf', $body['mimeType']);
        self::assertFalse($body['hasPassword']);
        self::assertSame(['facture', 'client-x'], $body['tags']);
        self::assertNotEmpty($body['downloadToken']);

        $file = $this->keepForCleanup((int) $body['id']);
        self::assertSame(self::OWNER_EMAIL, $file->getOwner()?->getEmail());
    }

    public function testItRejectsAnUploadWithoutAToken(): void
    {
        $this->upload(null);

        self::assertResponseStatusCodeSame(401);
    }

    public function testItRejectsAnUploadWithAnInvalidToken(): void
    {
        $this->upload('ceci-n-est-pas-un-jwt');

        self::assertResponseStatusCodeSame(401);
    }

    public function testItRejectsAnUploadWithAnExpiredToken(): void
    {
        $this->upload($this->expiredToken($this->owner));

        self::assertResponseStatusCodeSame(401);
    }

    public function testItStoresTheDownloadPasswordHashedAndNeverReturnsIt(): void
    {
        $this->upload($this->token($this->owner), ['password' => 'un-mot-de-passe']);

        self::assertResponseStatusCodeSame(201);
        $body = $this->decodeResponse();
        self::assertTrue($body['hasPassword']);
        self::assertArrayNotHasKey('password', $body);

        $file = $this->keepForCleanup((int) $body['id']);
        self::assertNotSame('un-mot-de-passe', $file->getPassword());
    }

    public function testItRejectsAFileLargerThanOneGigabyte(): void
    {
        $oversizedPath = $this->createFileOfSize(1_000_000_001);

        try {
            $this->upload(
                $this->token($this->owner),
                file: new UploadedFile($oversizedPath, 'gros-fichier.bin', 'application/octet-stream', test: true),
            );
        } finally {
            @unlink($oversizedPath);
        }

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['file'], $this->violatedFields());
    }

    public function testItRejectsAForbiddenExtension(): void
    {
        $this->upload(
            $this->token($this->owner),
            file: new UploadedFile($this->smallFilePath(), 'script.exe', 'application/x-msdownload', test: true),
        );

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['file'], $this->violatedFields());
    }

    public function testItRejectsAnExpirationOfMoreThanSevenDays(): void
    {
        $this->upload($this->token($this->owner), ['expiresInDays' => '8']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['expiresInDays'], $this->violatedFields());
    }

    public function testItRejectsAPasswordShorterThanSixCharacters(): void
    {
        $this->upload($this->token($this->owner), ['password' => '12345']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['password'], $this->violatedFields());
    }

    public function testItRejectsDuplicateTags(): void
    {
        $this->upload($this->token($this->owner), ['tags' => ['facture', 'facture']]);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['tags'], $this->violatedFields());
    }

    public function testItRejectsARequestWithoutAFile(): void
    {
        $this->client->request(
            'POST',
            '/api/files',
            server: [
                'HTTP_AUTHORIZATION' => 'Bearer '.$this->token($this->owner),
                'HTTP_ACCEPT' => 'application/json',
                'CONTENT_TYPE' => 'multipart/form-data',
            ],
        );

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['file'], $this->violatedFields());
    }

    /**
     * @param array<string, mixed> $fields
     */
    private function upload(?string $token, array $fields = [], ?UploadedFile $file = null): void
    {
        $server = ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'multipart/form-data'];
        if (null !== $token) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer '.$token;
        }

        $this->client->request(
            'POST',
            '/api/files',
            parameters: $fields,
            files: ['file' => $file ?? new UploadedFile($this->smallFilePath(), 'rapport.pdf', 'application/pdf', test: true)],
            server: $server,
        );
    }

    private function smallFilePath(): string
    {
        static $path = null;
        if (null === $path) {
            $path = tempnam(sys_get_temp_dir(), 'upload-test-');
            file_put_contents($path, 'contenu du fichier');
        }

        return $path;
    }

    private function createFileOfSize(int $bytes): string
    {
        $path = tempnam(sys_get_temp_dir(), 'upload-test-');
        $handle = fopen($path, 'w');
        ftruncate($handle, $bytes);
        fclose($handle);

        return $path;
    }

    private function createUser(string $email): User
    {
        $user = new User();
        $user->setEmail($email);
        $user->setFirstName('Alice');
        $user->setLastName('Martin');
        $user->setPassword(
            static::getContainer()->get(UserPasswordHasherInterface::class)
                ->hashPassword($user, self::OWNER_PASSWORD),
        );

        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
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

    private function storage(): FilesystemOperator
    {
        return static::getContainer()->get('default.storage');
    }

    private function keepForCleanup(int $fileId): File
    {
        $file = static::getContainer()->get(FileRepository::class)->find($fileId);
        self::assertInstanceOf(File::class, $file);

        $this->writtenStorageKeys[] = $file->getStorageKey();

        return $file;
    }

    /**
     * @return array<string, mixed>
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
