<?php

namespace App\Tests\Unit\State;

use ApiPlatform\Metadata\Post;
use App\ApiResource\DownloadPasswordInput;
use App\ApiResource\PresignedDownloadUrl;
use App\Entity\File;
use App\Repository\FileRepository;
use App\State\DownloadFileResolver;
use App\State\DownloadProcessor;
use Aws\CommandInterface;
use Aws\S3\S3Client;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\UriInterface;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;

#[CoversClass(DownloadProcessor::class)]
final class DownloadProcessorTest extends TestCase
{
    private const string BUCKET = 'datashare';
    private const string STORAGE_KEY = 'abc123.pdf';
    private const string DOWNLOAD_TOKEN = 'a-download-token';

    public function testItIssuesAPresignedUrlWhenTheFileIsNotPasswordProtected(): void
    {
        $hasher = $this->createMock(PasswordHasherInterface::class);
        $hasher->expects($this->never())->method('verify');

        $processor = $this->processor(
            $this->unprotectedFile(),
            $this->s3ClientReturning('https://minio.local/datashare/abc123.pdf?signed'),
            $hasher,
        );

        $result = $processor->process(new DownloadPasswordInput(), new Post(), ['downloadToken' => self::DOWNLOAD_TOKEN]);

        self::assertInstanceOf(PresignedDownloadUrl::class, $result);
        self::assertSame('https://minio.local/datashare/abc123.pdf?signed', $result->presignedUrl);
        self::assertSame(60, $result->expiresIn);
    }

    public function testItRejectsAMissingPasswordOnAProtectedFile(): void
    {
        $processor = $this->processor(
            $this->protectedFile('hashed-secret'),
            $this->createStub(S3Client::class),
            $this->createStub(PasswordHasherInterface::class),
        );

        try {
            $processor->process(new DownloadPasswordInput(), new Post(), ['downloadToken' => self::DOWNLOAD_TOKEN]);
            self::fail('Expected an HttpException to be thrown.');
        } catch (HttpException $exception) {
            self::assertSame(401, $exception->getStatusCode());
        }
    }

    public function testItRejectsAnInvalidPasswordOnAProtectedFile(): void
    {
        $hasher = $this->createStub(PasswordHasherInterface::class);
        $hasher->method('verify')->willReturn(false);

        $processor = $this->processor($this->protectedFile('hashed-secret'), $this->createStub(S3Client::class), $hasher);

        $input = new DownloadPasswordInput();
        $input->password = 'wrong-password';

        try {
            $processor->process($input, new Post(), ['downloadToken' => self::DOWNLOAD_TOKEN]);
            self::fail('Expected an HttpException to be thrown.');
        } catch (HttpException $exception) {
            self::assertSame(401, $exception->getStatusCode());
        }
    }

    public function testItIssuesAPresignedUrlWhenTheCorrectPasswordIsSubmitted(): void
    {
        $hasher = $this->createMock(PasswordHasherInterface::class);
        $hasher->expects($this->once())
            ->method('verify')
            ->with('hashed-secret', 'correct-password')
            ->willReturn(true);

        $processor = $this->processor(
            $this->protectedFile('hashed-secret'),
            $this->s3ClientReturning('https://minio.local/signed'),
            $hasher,
        );

        $input = new DownloadPasswordInput();
        $input->password = 'correct-password';

        $result = $processor->process($input, new Post(), ['downloadToken' => self::DOWNLOAD_TOKEN]);

        self::assertSame('https://minio.local/signed', $result->presignedUrl);
    }

    public function testItSetsTheContentDispositionToTheOriginalFileName(): void
    {
        $command = $this->createStub(CommandInterface::class);

        $s3Client = $this->createMock(S3Client::class);
        $s3Client->expects($this->once())
            ->method('getCommand')
            ->with('GetObject', [
                'Bucket' => self::BUCKET,
                'Key' => self::STORAGE_KEY,
                'ResponseContentDisposition' => 'attachment; filename="rapport.pdf"',
            ])
            ->willReturn($command);
        $s3Client->method('createPresignedRequest')->willReturn($this->requestReturning('https://minio.local/signed'));

        $processor = $this->processor($this->unprotectedFile(), $s3Client, $this->createStub(PasswordHasherInterface::class));

        $processor->process(new DownloadPasswordInput(), new Post(), ['downloadToken' => self::DOWNLOAD_TOKEN]);
    }

    private function processor(File $file, S3Client $s3Client, PasswordHasherInterface $hasher): DownloadProcessor
    {
        return new DownloadProcessor($this->resolverFor($file), $s3Client, self::BUCKET, $hasher);
    }

    private function resolverFor(File $file): DownloadFileResolver
    {
        $repository = $this->createStub(FileRepository::class);
        $repository->method('findOneBy')->willReturn($file);

        return new DownloadFileResolver($repository);
    }

    private function unprotectedFile(): File
    {
        return (new File())
            ->setName('rapport.pdf')
            ->setStorageKey(self::STORAGE_KEY)
            ->setExpirationDate((new \DateTimeImmutable())->modify('+1 day'));
    }

    private function protectedFile(string $hashedPassword): File
    {
        return $this->unprotectedFile()->setPassword($hashedPassword);
    }

    private function s3ClientReturning(string $presignedUrl): S3Client
    {
        $s3Client = $this->createStub(S3Client::class);
        $s3Client->method('getCommand')->willReturn($this->createStub(CommandInterface::class));
        $s3Client->method('createPresignedRequest')->willReturn($this->requestReturning($presignedUrl));

        return $s3Client;
    }

    private function requestReturning(string $uri): RequestInterface
    {
        $psrUri = $this->createStub(UriInterface::class);
        $psrUri->method('__toString')->willReturn($uri);

        $request = $this->createStub(RequestInterface::class);
        $request->method('getUri')->willReturn($psrUri);

        return $request;
    }
}
