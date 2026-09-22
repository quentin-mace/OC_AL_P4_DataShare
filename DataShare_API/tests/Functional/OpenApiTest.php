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
     *
     * Every route is listed rather than the fixed ones alone: a new operation
     * added without a summary then fails here instead of reaching Swagger UI
     * describing the table it happens to hang off.
     */
    public function testEveryRouteDescribesItsActionRatherThanItsResource(): void
    {
        $expected = [
            'GET /api/downloads/{downloadToken}' => 'Retrieves the metadata behind a share link.',
            'POST /api/downloads/{downloadToken}' => 'Issues a short-lived presigned download URL.',
            'GET /api/files' => "Retrieves the authenticated user's upload history.",
            'POST /api/files' => 'Uploads a file, with or without an account.',
            'DELETE /api/files/{id}' => 'Deletes the file and its stored object.',
            'POST /api/files/{id}/tags' => 'Adds a tag to the file.',
            'PUT /api/files/{id}/tags/{tag}' => 'Renames a tag on this file only.',
            'DELETE /api/files/{id}/tags/{tag}' => 'Removes a tag from the file.',
            // Written by the Lexik bundle, and already saying what it does.
            'POST /api/login' => 'Creates a user token.',
            'POST /api/register' => 'Registers a new account.',
        ];

        // Sorted on both sides: the paths come out in declaration order, which
        // is not something this test has any reason to pin down.
        ksort($expected);

        self::assertSame($expected, $this->summaries());
    }

    /**
     * The string shorthand for a URI variable documents it as "File
     * identifier", which a download token is not: it is the whole share link,
     * and confusing it with the id is how a history leaks.
     */
    public function testItDescribesTheShareTokenAsATokenAndNotAnIdentifier(): void
    {
        foreach (['getGet', 'getPost'] as $accessor) {
            $parameters = $this->openApi->getPaths()->getPath('/api/downloads/{downloadToken}')->{$accessor}()
                ->getParameters();

            self::assertSame('downloadToken', $parameters[0]->getName());
            self::assertSame('The unpredictable token from the shared download link', $parameters[0]->getDescription());
        }
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

    /**
     * @return array<string, ?string> keyed by "METHOD /path"
     */
    private function summaries(): array
    {
        $summaries = [];

        foreach ($this->openApi->getPaths()->getPaths() as $path => $pathItem) {
            foreach (['Get', 'Post', 'Put', 'Patch', 'Delete'] as $method) {
                $operation = $pathItem->{'get'.$method}();

                if (null !== $operation) {
                    $summaries[strtoupper($method).' '.$path] = $operation->getSummary();
                }
            }
        }

        ksort($summaries);

        return $summaries;
    }
}
