<?php

namespace App\Tests\Unit\State;

use ApiPlatform\Metadata\Post;
use App\ApiResource\DownloadPasswordInput;
use App\ApiResource\PresignedDownloadUrl;
use App\Entity\File;
use App\Repository\FileRepository;
use App\State\DownloadFileResolver;
use App\State\DownloadPasswordThrottle;
use App\State\DownloadProcessor;
use Aws\CommandInterface;
use Aws\S3\S3Client;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\UriInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;

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

    /**
     * The limit has to be seen before the password is compared, otherwise an
     * attacker only has to keep going until they land on the right one.
     */
    public function testItDoesNotVerifyThePasswordOnceThrottled(): void
    {
        $hasher = $this->createMock(PasswordHasherInterface::class);
        $hasher->expects($this->never())->method('verify');

        $throttle = $this->throttle();
        for ($attempt = 1; $attempt <= 5; ++$attempt) {
            $throttle->recordFailedAttempt(self::DOWNLOAD_TOKEN);
        }

        $processor = $this->processor(
            $this->protectedFile('hashed-secret'),
            $this->createStub(S3Client::class),
            $hasher,
            $throttle,
        );

        $input = new DownloadPasswordInput();
        $input->password = 'correct-password';

        $this->expectException(TooManyRequestsHttpException::class);

        $processor->process($input, new Post(), ['downloadToken' => self::DOWNLOAD_TOKEN]);
    }

    public function testItNeverThrottlesAFileWithoutPassword(): void
    {
        $processor = $this->processor(
            $this->unprotectedFile(),
            $this->s3ClientReturning('https://minio.local/signed'),
            $this->createStub(PasswordHasherInterface::class),
        );

        for ($attempt = 1; $attempt <= 6; ++$attempt) {
            $result = $processor->process(new DownloadPasswordInput(), new Post(), ['downloadToken' => self::DOWNLOAD_TOKEN]);
            self::assertSame('https://minio.local/signed', $result->presignedUrl);
        }
    }

    public function testASuccessfulPasswordFreesTheCounter(): void
    {
        $hasher = $this->createStub(PasswordHasherInterface::class);
        $hasher->method('verify')->willReturnCallback(
            static fn (string $hashed, string $plain): bool => 'correct-password' === $plain,
        );

        $processor = $this->processor(
            $this->protectedFile('hashed-secret'),
            $this->s3ClientReturning('https://minio.local/signed'),
            $hasher,
            $this->throttle(),
        );

        $wrong = new DownloadPasswordInput();
        $wrong->password = 'wrong-password';
        $right = new DownloadPasswordInput();
        $right->password = 'correct-password';

        // Four failures, a success that clears them, then four more: none of
        // them may add up to a block.
        foreach ([$wrong, $wrong, $wrong, $wrong, $right, $wrong, $wrong, $wrong, $wrong] as $input) {
            try {
                $processor->process($input, new Post(), ['downloadToken' => self::DOWNLOAD_TOKEN]);
            } catch (HttpException $exception) {
                self::assertSame(401, $exception->getStatusCode());
            }
        }

        $result = $processor->process($right, new Post(), ['downloadToken' => self::DOWNLOAD_TOKEN]);

        self::assertSame('https://minio.local/signed', $result->presignedUrl);
    }

    private function processor(File $file, S3Client $s3Client, PasswordHasherInterface $hasher, ?DownloadPasswordThrottle $throttle = null): DownloadProcessor
    {
        return new DownloadProcessor($this->resolverFor($file), $s3Client, self::BUCKET, $hasher, $throttle ?? $this->throttle());
    }

    /**
     * A real throttle on in-memory storage rather than a double: the class is
     * final readonly, and the counting is what these tests are about.
     */
    private function throttle(): DownloadPasswordThrottle
    {
        $storage = new InMemoryStorage();

        $requestStack = new RequestStack();
        $requestStack->push(Request::create('/api/downloads/'.self::DOWNLOAD_TOKEN, 'POST', server: ['REMOTE_ADDR' => '203.0.113.7']));

        return new DownloadPasswordThrottle(
            new RateLimiterFactory(['id' => 'download_password_link', 'policy' => 'fixed_window', 'limit' => 5, 'interval' => '15 minutes'], $storage),
            new RateLimiterFactory(['id' => 'download_password_client', 'policy' => 'fixed_window', 'limit' => 25, 'interval' => '15 minutes'], $storage),
            $requestStack,
            'a-test-secret',
        );
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
            ->setDownloadToken(self::DOWNLOAD_TOKEN)
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
