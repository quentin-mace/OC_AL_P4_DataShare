<?php

namespace App\Tests\Functional;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Encoder\JWTEncoderInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class UserLoginTest extends WebTestCase
{
    private const string EMAIL = 'alice@example.com';
    private const string PASSWORD = 'correct-cheval-batterie';

    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->resetLoginThrottling();
        $this->createUser();
    }

    public function testItReturnsATokenForValidCredentials(): void
    {
        $this->login(self::EMAIL, self::PASSWORD);

        self::assertResponseIsSuccessful();
        self::assertResponseStatusCodeSame(200);
        self::assertSame(['token'], array_keys($this->decodeResponse()));
        self::assertNotEmpty($this->decodeResponse()['token']);
    }

    /**
     * The token is what every later request will be authorized on, so its
     * payload has to name the user, carry their roles and expire.
     */
    public function testTheTokenCarriesTheUserIdentityRolesAndAnExpiry(): void
    {
        $this->login(self::EMAIL, self::PASSWORD);

        $payload = static::getContainer()->get(JWTEncoderInterface::class)
            ->decode($this->decodeResponse()['token']);

        self::assertSame(self::EMAIL, $payload['username']);
        self::assertSame(['ROLE_USER'], $payload['roles']);
        self::assertSame(3600, $payload['exp'] - $payload['iat']);
    }

    /**
     * A token cannot be revoked, so nothing may be stored server-side either:
     * a session cookie would quietly become a second way in.
     */
    public function testItOpensNoSession(): void
    {
        $this->login(self::EMAIL, self::PASSWORD);

        self::assertResponseNotHasCookie('PHPSESSID');
    }

    public function testItRejectsAWrongPassword(): void
    {
        $this->login(self::EMAIL, 'ce-nest-pas-le-bon-mot-de-passe');

        self::assertResponseStatusCodeSame(401);
    }

    public function testItRejectsAnUnknownEmail(): void
    {
        $this->login('personne@example.com', self::PASSWORD);

        self::assertResponseStatusCodeSame(401);
    }

    /**
     * Telling the two cases apart would turn the endpoint into a way of
     * checking which email addresses have an account here.
     */
    public function testItAnswersIdenticallyForAWrongPasswordAndAnUnknownEmail(): void
    {
        $this->login(self::EMAIL, 'ce-nest-pas-le-bon-mot-de-passe');
        $wrongPassword = $this->client->getResponse()->getContent();

        $this->login('personne@example.com', self::PASSWORD);
        $unknownEmail = $this->client->getResponse()->getContent();

        self::assertSame($wrongPassword, $unknownEmail);
    }

    /**
     * Guessing a password is only worth attempting at speed, so the endpoint
     * stops answering after a handful of failures.
     */
    public function testItBlocksAfterTooManyFailedAttempts(): void
    {
        for ($attempt = 1; $attempt <= 5; ++$attempt) {
            $this->login(self::EMAIL, 'ce-nest-pas-le-bon-mot-de-passe');
            self::assertResponseStatusCodeSame(401, "Attempt {$attempt} should still be answered.");
        }

        $this->login(self::EMAIL, 'ce-nest-pas-le-bon-mot-de-passe');

        self::assertResponseStatusCodeSame(429);
    }

    /**
     * The block has to come before the password is even looked at, otherwise an
     * attacker only has to keep going until they land on the right one.
     */
    public function testItBlocksTheRightPasswordTooOnceThrottled(): void
    {
        for ($attempt = 1; $attempt <= 5; ++$attempt) {
            $this->login(self::EMAIL, 'ce-nest-pas-le-bon-mot-de-passe');
        }

        $this->login(self::EMAIL, self::PASSWORD);

        self::assertResponseStatusCodeSame(429);
    }

    public function testItRejectsABodyWithoutCredentials(): void
    {
        $this->post('{}');

        self::assertResponseStatusCodeSame(400);
    }

    public function testItRejectsAMalformedBody(): void
    {
        $this->post('pas-du-json');

        self::assertResponseStatusCodeSame(400);
    }

    private function login(string $email, string $password): void
    {
        $this->post((string) json_encode(
            ['email' => $email, 'password' => $password],
            JSON_THROW_ON_ERROR,
        ));
    }

    private function post(string $json): void
    {
        $this->client->request(
            'POST',
            '/api/login',
            server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'],
            content: $json,
        );
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
     * The rate limiter counts in a cache pool, which outlives the database
     * transaction: without this, failures from one test would be held against
     * the next one.
     */
    private function resetLoginThrottling(): void
    {
        static::getContainer()->get('cache.rate_limiter')->clear();
    }

    private function createUser(): void
    {
        $user = new User();
        $user->setEmail(self::EMAIL);
        $user->setFirstName('Alice');
        $user->setLastName('Martin');
        $user->setPassword(
            static::getContainer()->get(UserPasswordHasherInterface::class)
                ->hashPassword($user, self::PASSWORD),
        );

        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
        $entityManager->persist($user);
        $entityManager->flush();
    }
}
