<?php

namespace App\Tests\Unit\State;

use App\Entity\File;
use App\Repository\FileRepository;
use App\State\DownloadFileResolver;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\Exception\GoneHttpException;

#[CoversClass(DownloadFileResolver::class)]
final class DownloadFileResolverTest extends TestCase
{
    public function testItReturnsTheFileForAValidToken(): void
    {
        $file = (new File())->setExpirationDate((new \DateTimeImmutable())->modify('+1 day'));

        $resolver = new DownloadFileResolver($this->fileRepository($file));

        self::assertSame($file, $resolver->resolve('a-valid-token'));
    }

    public function testItRejectsAnUnknownToken(): void
    {
        $resolver = new DownloadFileResolver($this->fileRepository(null));

        $this->expectException(GoneHttpException::class);

        $resolver->resolve('unknown-token');
    }

    public function testItRejectsAnExpiredToken(): void
    {
        $file = (new File())->setExpirationDate((new \DateTimeImmutable())->modify('-1 second'));

        $resolver = new DownloadFileResolver($this->fileRepository($file));

        $this->expectException(GoneHttpException::class);

        $resolver->resolve('an-expired-token');
    }

    private function fileRepository(?File $file): FileRepository
    {
        $repository = $this->createStub(FileRepository::class);
        $repository->method('findOneBy')->willReturn($file);

        return $repository;
    }
}
