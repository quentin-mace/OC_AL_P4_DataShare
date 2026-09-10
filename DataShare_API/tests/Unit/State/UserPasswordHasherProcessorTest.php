<?php

namespace App\Tests\Unit\State;

use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\User;
use App\State\UserPasswordHasherProcessor;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[CoversClass(UserPasswordHasherProcessor::class)]
final class UserPasswordHasherProcessorTest extends TestCase
{
    public function testItHashesThePlainPasswordThenForgetsIt(): void
    {
        $user = (new User())
            ->setEmail('alice@example.com')
            ->setFirstName('Alice')
            ->setLastName('Martin')
            ->setPlainPassword('correct-cheval-batterie');

        $hasher = $this->createMock(UserPasswordHasherInterface::class);
        $hasher->expects($this->once())
            ->method('hashPassword')
            ->with($user, 'correct-cheval-batterie')
            ->willReturn('hashed-password');

        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects($this->once())
            ->method('process')
            ->with($user)
            ->willReturnArgument(0);

        $processor = new UserPasswordHasherProcessor($persistProcessor, $hasher);
        $result = $processor->process($user, new Post());

        self::assertSame('hashed-password', $result->getPassword());
        self::assertNull($result->getPlainPassword());
    }

    /**
     * Validation rejects a blank password before the processor runs, so this
     * branch only guards against reusing the processor on an operation that
     * does not submit one.
     */
    public function testItLeavesThePasswordUntouchedWhenNoPlainPasswordIsSubmitted(): void
    {
        $user = (new User())
            ->setEmail('alice@example.com')
            ->setPassword('already-hashed');

        $hasher = $this->createMock(UserPasswordHasherInterface::class);
        $hasher->expects($this->never())->method('hashPassword');

        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects($this->once())
            ->method('process')
            ->willReturnArgument(0);

        $processor = new UserPasswordHasherProcessor($persistProcessor, $hasher);
        $result = $processor->process($user, new Post());

        self::assertSame('already-hashed', $result->getPassword());
    }
}
