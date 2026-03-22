namespace MoiEx.Services
{
    public interface IImageCompressionService
    {
        Task<dynamic> CompressImagesAsync(List<IFormFile> files, int quality = 75, int maxWidth = 1920, int maxHeight = 1920, CancellationToken cancellationToken = default);
    }
    public class ImageCompressionService
    {
    }
}
