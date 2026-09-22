<?php

namespace App\Tests\Functional;

use ApiPlatform\OpenApi\Factory\OpenApiFactoryInterface;
use ApiPlatform\OpenApi\OpenApi;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * The documentation is the contract the front reads before writing a line, so
 * the places where the generated default is wrong are pinned here. Nothing
 * else in the test suite would notice them drifting back.
 */
final class OpenApiTest extends WebTestCase
{
    private OpenApi $openApi;

    protected function setUp(): void
    {
        static::createClient();
        $this->openApi = static::getContainer()->get(OpenApiFactoryInterface::class)();
    }

    /**
     * API Platform derives a summary from the method and the resource, which
     * reads "Creates a File resource." on a route that creates nothing and
     * "Removes the File resource." on one that only detaches a tag.
     */
    public function testItDescribesTheActionRatherThanTheResource(): void
    {
        self::assertSame(
            'Issues a short-lived presigned download URL.',
            $this->summary('/api/downloads/{downloadToken}', 'post'),
        );
        self::assertSame('Adds a tag to the file.', $this->summary('/api/files/{id}/tags', 'post'));
        self::assertSame('Renames a tag on this file only.', $this->summary('/api/files/{id}/tags/{tag}', 'put'));
        self::assertSame('Removes a tag from the file.', $this->summary('/api/files/{id}/tags/{tag}', 'delete'));
    }

    /**
     * A DELETE is documented without a response body whatever its status, so
     * the schema of this one is declared by hand.
     */
    public function testItDocumentsTheBodyAnsweredByTheTagRemoval(): void
    {
        $response = $this->openApi->getPaths()->getPath('/api/files/{id}/tags/{tag}')->getDelete()
            ->getResponses()['200'] ?? null;

        self::assertNotNull($response, 'The tag removal answers 200 with the remaining tags.');
        self::assertSame(
            ['$ref' => '#/components/schemas/File-file.tags'],
            $response->getContent()['application/json']['schema'],
        );
    }

    /**
     * The shape every tag route answers with, and the one the dashboard reads.
     */
    public function testItDocumentsTheTagResponseAsAnIdAndAListOfNames(): void
    {
        $schema = $this->openApi->getComponents()->getSchemas()['File-file.tags'];

        self::assertSame(['id', 'tags'], array_keys((array) $schema['properties']));
        self::assertSame('integer', $schema['properties']['id']['type']);
        self::assertSame(['type' => 'string'], $schema['properties']['tags']['items']);
    }

    private function summary(string $path, string $method): ?string
    {
        $operation = $this->openApi->getPaths()->getPath($path)->{'get'.ucfirst($method)}();

        return $operation?->getSummary();
    }
}
