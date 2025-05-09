import { Controller, Post, UseInterceptors, Res, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Post('import')
    @UseInterceptors(FilesInterceptor('files', 10, {
        storage: diskStorage({
            destination: './uploads/files',
            filename: (req, file, cb) => {
                const date = new Date().toISOString().replace(/[:]/g, '-');
                const fileName = `${date}-${file.originalname}`;
                file.filename = fileName;
                cb(null, fileName);
            },
        }),
    }))
    async importFiles(@UploadedFiles() files: Express.Multer.File[], @Res() res: Response) {
        const results: Array<{ filename: string; status: string; error?: any; [key: string]: any }> = [];

        for (const file of files) {
            try {
                const result = await this.userService.importUsers(file);
                results.push({
                    filename: file.originalname,
                    status: 'success',
                    ...result,
                });
            } catch (error) {
                results.push({
                    filename: file.originalname,
                    status: 'failed',
                    error: error.message,
                });
            }
        }

        return res.status(201).json({
            statusCode: 201,
            totalFiles: files.length,
            results,
        });
    }
}
