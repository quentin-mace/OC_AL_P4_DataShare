<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\ApiResource\DownloadPasswordInput;
use App\ApiResource\PresignedDownloadUrl;
use Aws\S3\S3Client;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\PasswordHasher\PasswordHasherInterface;

/**
 * Checks the download link's password, if any, then issues a short-lived
 * presigned GET URL. PHP never streams the file itself: see the "Transit des
 * fichiers" decision in docs/architectureDecisions/tech_stack.md.
 *
 * @implements ProcessorInterface<DownloadPasswordInput, PresignedDownloadUrl>
 */
final readonly class DownloadProcessor implements ProcessorInterface
{
    /**
     * A presigned URL's validity only needs to cover the browser starting the
     * GET request, not the transfer itself, regardless of file size: see the
     * "Duree de vie de l'URL presignee de telechargement" decision in
     * tech_stack.md.
     */
    private const int PRESIGNED_URL_TTL_IN_SECONDS = 60;

    public function __construct(
        private DownloadFileResolver $resolver,
        #[Autowire(service: 'aws.s3.public_client')]
        private S3Client $s3PublicClient,
        #[Autowire(env: 'STORAGE_S3_BUCKET')]
        private string $bucket,
        private PasswordHasherInterface $passwordHasher,
    ) {
    }

    /**
     * @param array<string, mixed> $uriVariables
     * @param array<string, mixed> $context
     */
    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): PresignedDownloadUrl
    {
        $file = $this->resolver->resolve($uriVariables['downloadToken']);

        if ($file->isPasswordProtected()
            && (null === $data->password || !$this->passwordHasher->verify((string) $file->getPassword(), $data->password))
        ) {
            throw new HttpException(Response::HTTP_UNAUTHORIZED, 'Mot de passe de telechargement invalide.');
        }

        $command = $this->s3PublicClient->getCommand('GetObject', [
            'Bucket' => $this->bucket,
            'Key' => $file->getStorageKey(),
            'ResponseContentDisposition' => sprintf('attachment; filename="%s"', $file->getName()),
        ]);

        $request = $this->s3PublicClient->createPresignedRequest($command, sprintf('+%d seconds', self::PRESIGNED_URL_TTL_IN_SECONDS));

        return new PresignedDownloadUrl((string) $request->getUri(), self::PRESIGNED_URL_TTL_IN_SECONDS);
    }
}
