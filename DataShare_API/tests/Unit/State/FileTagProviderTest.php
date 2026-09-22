<?php

namespace App\Tests\Unit\State;

use ApiPlatform\Metadata\Post;
use App\Entity\File;
use App\Repository\FileRepository;
use App\State\FileTagProvider;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[CoversClass(FileTagProvider::class)]
final class FileTagProviderTest extends TestCase
{
    public function testItReturnsTheFileBehindTheIdentifier(): void
    {
        $file = new File();
        $repository = $this->createMock(FileRepository::class);
        $repository->expects(self::once())->method('find')->with(3)->willReturn($file);

        $provided = (new FileTagProvider($repository))->provide(new Post(), ['id' => '3', 'tag' => 'facture']);

        self::assertSame($file, $provided);
    }

    public function testItAnswersNotFoundForAnUnknownFile(): void
    {
        $repository = $this->createStub(FileRepository::class);
        $repository->method('find')->willReturn(null);

        $this->expectException(NotFoundHttpException::class);

        (new FileTagProvider($repository))->provide(new Post(), ['id' => '3']);
    }

    /**
     * The route requirement keeps a non-numeric id out, so this guard only
     * stops PHPStan and a hand-built call from casting "abc" to 0.
     */
    public function testItAnswersNotFoundForANonNumericIdentifier(): void
    {
        $repository = $this->createMock(FileRepository::class);
        $repository->expects(self::never())->method('find');

        $this->expectException(NotFoundHttpException::class);

        (new FileTagProvider($repository))->provide(new Post(), ['id' => 'abc']);
    }
}
