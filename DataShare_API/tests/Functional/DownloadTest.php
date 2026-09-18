<?php

namespace App\Tests\Functional;

use App\Entity\File;
use App\Entity\User;
use App\Repository\FileRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use League\Flysystem\FilesystemOperator;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class DownloadTest extends WebTestCase
{
    private const string OWNER_EMAIL = 'alice@example.com';

    private KernelBrowser $client;

    /**
     * @var list<string>
     */
    private array $writtenStorageKeys = [];

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->createUser(self::OWNER_EMAIL);
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

    public function testItReturnsTheMetadataOfAValidLink(): void
    {
        $token = $this->uploadFile()['downloadToken'];

        $this->client->request('GET', "/api/downloads/{$token}", server: ['HTTP_ACCEPT' => 'application/json']);

        self::assertResponseStatusCodeSame(200);
        $body = $this->decodeResponse();
        self::assertEqualsCanonicalizing(['name', 'size', 'mimeType', 'expiresAt', 'hasPassword'], array_keys($body));
        self::assertSame('rapport.pdf', $body['name']);
        self::assertSame('application/pdf', $body['mimeType']);
        self::assertFalse($body['hasPassword']);
    }

    public function testItReturnsThatTheLinkIsPasswordProtected(): void
    {
        $token = $this->uploadFile(['password' => 'un-mot-de-passe'])['downloadToken'];

        $this->client->request('GET', "/api/downloads/{$token}", server: ['HTTP_ACCEPT' => 'application/json']);

        self::assertTrue($this->decodeResponse()['hasPassword']);
    }

    public function testItReturns410ForAnUnknownTokenOnGet(): void
    {
        $this->client->request('GET', '/api/downloads/ce-token-n-existe-pas', server: ['HTTP_ACCEPT' => 'application/json']);

        self::assertResponseStatusCodeSame(410);
    }

    public function testItReturns410ForAnExpiredTokenOnGet(): void
    {
        $token = $this->uploadAndExpireFile();

        $this->client->request('GET', "/api/downloads/{$token}", server: ['HTTP_ACCEPT' => 'application/json']);

        self::assertResponseStatusCodeSame(410);
    }

    public function testItIssuesAPresignedUrlWhenNoPasswordIsRequired(): void
    {
        $token = $this->uploadFile()['downloadToken'];

        $this->postDownload($token);

        self::assertResponseStatusCodeSame(200);
        $body = $this->decodeResponse();
        self::assertEqualsCanonicalizing(['presignedUrl', 'expiresIn'], array_keys($body));
        self::assertSame(60, $body['expiresIn']);
        self::assertNotEmpty($body['presignedUrl']);
    }

    public function testItRejectsAMissingPasswordOnAProtectedLink(): void
    {
        $token = $this->uploadFile(['password' => 'un-mot-de-passe'])['downloadToken'];

        $this->postDownload($token);

        self::assertResponseStatusCodeSame(401);
    }

    public function testItRejectsAnIncorrectPasswordOnAProtectedLink(): void
    {
        $token = $this->uploadFile(['password' => 'un-mot-de-passe'])['downloadToken'];

        $this->postDownload($token, 'un-mauvais-mot-de-passe');

        self::assertResponseStatusCodeSame(401);
    }

    public function testItIssuesAPresignedUrlWithTheCorrectPassword(): void
    {
        $token = $this->uploadFile(['password' => 'un-mot-de-passe'])['downloadToken'];

        $this->postDownload($token, 'un-mot-de-passe');

        self::assertResponseStatusCodeSame(200);
        self::assertNotEmpty($this->decodeResponse()['presignedUrl']);
    }

    public function testItReturns410ForAnUnknownTokenOnPost(): void
    {
        $this->postDownload('ce-token-n-existe-pas');

        self::assertResponseStatusCodeSame(410);
    }

    public function testItReturns410ForAnExpiredTokenOnPost(): void
    {
        $token = $this->uploadAndExpireFile();

        $this->postDownload($token);

        self::assertResponseStatusCodeSame(410);
    }

    /**
     * @param array<string, mixed> $fields
     *
     * @return array<string, mixed>
     */
    private function uploadFile(array $fields = []): array
    {
        $this->client->request(
            'POST',
            '/api/files',
            parameters: $fields,
            files: ['file' => new UploadedFile($this->smallFilePath(), 'rapport.pdf', 'application/pdf', test: true)],
            server: [
                'HTTP_AUTHORIZATION' => 'Bearer '.$this->token(),
                'HTTP_ACCEPT' => 'application/json',
                'CONTENT_TYPE' => 'multipart/form-data',
            ],
        );

        $body = $this->decodeResponse();
        $this->writtenStorageKeys[] = static::getContainer()->get(FileRepository::class)
            ->find((int) $body['id'])
            ->getStorageKey();

        return $body;
    }

    private function uploadAndExpireFile(): string
    {
        $body = $this->uploadFile();

        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
        $file = static::getContainer()->get(FileRepository::class)->find((int) $body['id']);
        self::assertInstanceOf(File::class, $file);
        $file->setExpirationDate((new \DateTimeImmutable())->modify('-1 second'));
        $entityManager->flush();

        return $body['downloadToken'];
    }

    private function postDownload(string $token, ?string $password = null): void
    {
        $content = null === $password ? '{}' : (string) json_encode(['password' => $password], JSON_THROW_ON_ERROR);

        $this->client->request(
            'POST',
            "/api/downloads/{$token}",
            server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'],
            content: $content,
        );
    }

    private function smallFilePath(): string
    {
        static $path = null;
        if (null === $path) {
            $path = tempnam(sys_get_temp_dir(), 'download-test-');
            file_put_contents($path, 'contenu du fichier');
        }

        return $path;
    }

    private function createUser(string $email): void
    {
        $user = new User();
        $user->setEmail($email);
        $user->setFirstName('Alice');
        $user->setLastName('Martin');
        $user->setPassword(
            static::getContainer()->get(UserPasswordHasherInterface::class)
                ->hashPassword($user, 'correct-cheval-batterie'),
        );

        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
        $entityManager->persist($user);
        $entityManager->flush();
    }

    private function token(): string
    {
        $user = static::getContainer()->get(UserRepository::class)->findOneBy(['email' => self::OWNER_EMAIL]);

        return static::getContainer()->get(JWTTokenManagerInterface::class)->create($user);
    }

    private function storage(): FilesystemOperator
    {
        return static::getContainer()->get('default.storage');
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
}
