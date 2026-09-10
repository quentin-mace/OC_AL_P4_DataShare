<?php

namespace App\Tests\Functional;

use App\Entity\User;
use App\Repository\UserRepository;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class UserRegistrationTest extends WebTestCase
{
    private const string VALID_PAYLOAD = '{"email":"alice@example.com","plainPassword":"correct-cheval-batterie","firstName":"Alice","lastName":"Martin"}';

    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();
    }

    public function testItCreatesAnAccount(): void
    {
        $this->register(self::VALID_PAYLOAD);

        self::assertResponseStatusCodeSame(201);
        self::assertResponseHeaderSame('Content-Type', 'application/json; charset=utf-8');

        $body = $this->decodeResponse();
        self::assertSame('alice@example.com', $body['email']);
        self::assertSame('Alice', $body['firstName']);
        self::assertSame('Martin', $body['lastName']);
        self::assertIsInt($body['id']);
    }

    /**
     * The serialization groups are the only thing keeping the hash out of the
     * response, so an accidental group change has to break a test.
     */
    public function testItNeverReturnsThePassword(): void
    {
        $this->register(self::VALID_PAYLOAD);

        self::assertResponseStatusCodeSame(201);
        self::assertSame(
            ['id', 'email', 'firstName', 'lastName'],
            array_keys($this->decodeResponse()),
        );
    }

    public function testItStoresThePasswordHashedAndSalted(): void
    {
        $this->register(self::VALID_PAYLOAD);

        $user = $this->findUser('alice@example.com');
        $hash = $user->getPassword();

        self::assertNotNull($hash);
        self::assertNotSame('correct-cheval-batterie', $hash);
        self::assertTrue(
            static::getContainer()->get(UserPasswordHasherInterface::class)
                ->isPasswordValid($user, 'correct-cheval-batterie'),
        );
    }

    /**
     * Two accounts registered with the same password must not share a hash,
     * which is what a per-password salt guarantees.
     */
    public function testItSaltsEachPasswordIndependently(): void
    {
        $this->register(self::VALID_PAYLOAD);
        $this->register('{"email":"bob@example.com","plainPassword":"correct-cheval-batterie","firstName":"Bob","lastName":"Durand"}');

        self::assertResponseStatusCodeSame(201);
        self::assertNotSame(
            $this->findUser('alice@example.com')->getPassword(),
            $this->findUser('bob@example.com')->getPassword(),
        );
    }

    public function testItRejectsAnAlreadyRegisteredEmail(): void
    {
        $this->register(self::VALID_PAYLOAD);
        $this->register(self::VALID_PAYLOAD);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['email'], $this->violatedFields());
    }

    /**
     * Fifteen distinct characters drawn from every character class: strong
     * enough to pass PasswordStrength, so only the length rule can reject it.
     */
    public function testItRejectsAPasswordShorterThanSixteenCharacters(): void
    {
        $this->register('{"email":"alice@example.com","plainPassword":"aB3$dE6&gH9!jK2","firstName":"Alice","lastName":"Martin"}');

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['plainPassword'], $this->violatedFields());
    }

    /**
     * Long enough to pass the length rule, but built from a single repeated
     * character, so only the strength rule can reject it.
     */
    public function testItRejectsALongButGuessablePassword(): void
    {
        $this->register('{"email":"alice@example.com","plainPassword":"aaaaaaaaaaaaaaaa","firstName":"Alice","lastName":"Martin"}');

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['plainPassword'], $this->violatedFields());
    }

    public function testItRejectsAMalformedEmail(): void
    {
        $this->register('{"email":"pas-un-email","plainPassword":"correct-cheval-batterie","firstName":"Alice","lastName":"Martin"}');

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['email'], $this->violatedFields());
    }

    public function testItRejectsMissingFields(): void
    {
        $this->register('{}');

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['email', 'plainPassword', 'firstName', 'lastName'], $this->violatedFields());
    }

    /**
     * Roles carry no serialization group, so a client cannot promote itself.
     */
    public function testItIgnoresRolesSubmittedByTheClient(): void
    {
        $this->register('{"email":"mallory@example.com","plainPassword":"correct-cheval-batterie","firstName":"Mal","lastName":"Ory","roles":["ROLE_ADMIN"]}');

        self::assertResponseStatusCodeSame(201);
        self::assertSame(['ROLE_USER'], $this->findUser('mallory@example.com')->getRoles());
    }

    /**
     * Same reasoning for the hash itself: a client-supplied value must not
     * become the stored password.
     */
    public function testItIgnoresAPasswordHashSubmittedByTheClient(): void
    {
        $this->register('{"email":"mallory@example.com","plainPassword":"correct-cheval-batterie","firstName":"Mal","lastName":"Ory","password":"injecte"}');

        self::assertResponseStatusCodeSame(201);
        self::assertNotSame('injecte', $this->findUser('mallory@example.com')->getPassword());
    }

    private function register(string $json): void
    {
        $this->client->request(
            'POST',
            '/api/users',
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
     * @return list<string> the property paths reported in the RFC 7807 payload
     */
    private function violatedFields(): array
    {
        return array_column($this->decodeResponse()['violations'], 'propertyPath');
    }

    private function findUser(string $email): User
    {
        $user = static::getContainer()->get(UserRepository::class)->findOneBy(['email' => $email]);
        self::assertInstanceOf(User::class, $user);

        return $user;
    }
}
