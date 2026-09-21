<?php

namespace App\Tests\Unit\State;

use ApiPlatform\Metadata\GetCollection;
use App\Entity\File;
use App\Entity\User;
use App\Repository\FileRepository;
use App\State\UserFilesProvider;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;

#[CoversClass(UserFilesProvider::class)]
final class UserFilesProviderTest extends TestCase
{
    public function testItReturnsTheFilesOfTheAuthenticatedUser(): void
    {
        $owner = new User();
        $files = [new File()];

        $repository = $this->createMock(FileRepository::class);
        $repository->expects(self::once())
            ->method('findByOwner')
            ->with($owner, null)
            ->willReturn($files);

        $provider = new UserFilesProvider($repository, $this->security($owner));

        self::assertSame($files, $provider->provide(new GetCollection()));
    }

    public function testItForwardsTheTagFilter(): void
    {
        $owner = new User();

        $repository = $this->createMock(FileRepository::class);
        $repository->expects(self::once())
            ->method('findByOwner')
            ->with($owner, 'facture')
            ->willReturn([]);

        $provider = new UserFilesProvider($repository, $this->security($owner));

        $provider->provide(new GetCollection(), context: ['filters' => ['tag' => '  facture  ']]);
    }

    /**
     * @param array<string, mixed> $filters
     */
    #[DataProvider('emptyTagFilters')]
    public function testItIgnoresAnEmptyTagFilter(array $filters): void
    {
        $owner = new User();

        $repository = $this->createMock(FileRepository::class);
        $repository->expects(self::once())
            ->method('findByOwner')
            ->with($owner, null)
            ->willReturn([]);

        $provider = new UserFilesProvider($repository, $this->security($owner));

        $provider->provide(new GetCollection(), context: ['filters' => $filters]);
    }

    /**
     * @return iterable<string, array{array<string, mixed>}>
     */
    public static function emptyTagFilters(): iterable
    {
        yield 'absent' => [[]];
        yield 'empty string' => [['tag' => '']];
        yield 'blank string' => [['tag' => '   ']];
        yield 'not a string' => [['tag' => ['facture']]];
    }

    public function testItRejectsAnUnauthenticatedRequest(): void
    {
        $provider = new UserFilesProvider(
            $this->createStub(FileRepository::class),
            $this->security(null),
        );

        $this->expectException(\LogicException::class);

        $provider->provide(new GetCollection());
    }

    private function security(?User $user): Security
    {
        $security = $this->createStub(Security::class);
        $security->method('getUser')->willReturn($user);

        return $security;
    }
}
